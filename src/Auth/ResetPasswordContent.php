<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Auth;

use DateTime;
use Flarum\Frontend\Document;
use Flarum\User\Exception\InvalidConfirmationTokenException;
use Flarum\User\PasswordToken;
use Illuminate\Contracts\Support\MessageProvider;
use Illuminate\Contracts\View\Factory;
use Illuminate\Support\Arr;
use Psr\Http\Message\ServerRequestInterface;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * /reset/{token} no fórum (a página "Redefinir senha" do tema), no lugar da
 * página solta do core (reset-password.blade.php).
 *
 * Valida o token exatamente como o ResetPasswordController do core (404 sem
 * token, erro de token inválido depois de um dia) e entrega ao JS o token e
 * os erros da tentativa anterior: o SavePasswordController do core continua
 * recebendo o POST /reset e, num erro de validação, volta para cá com os
 * erros na sessão — que o ShareErrorsFromSession já tirou da sessão e
 * compartilhou com as views.
 */
final class ResetPasswordContent
{
    public function __construct(
        private readonly Factory $view,
        private readonly TranslatorInterface $translator
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $token = PasswordToken::findOrFail((string) Arr::get($request->getQueryParams(), 'token'));

        if ($token->created_at < new DateTime('-1 day')) {
            throw new InvalidConfirmationTokenException();
        }

        $errors = $this->view->shared('errors');
        $messages = $errors instanceof MessageProvider ? $errors->getMessageBag()->all() : [];

        $document->title = $this->translator->trans('core.views.reset_password.title');
        $document->payload['canelaReset'] = [
            'token' => $token->token,
            'errors' => array_values(array_map('strval', $messages)),
        ];
    }
}
