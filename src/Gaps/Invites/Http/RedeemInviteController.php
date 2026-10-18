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

namespace Ramon\Canela\Gaps\Invites\Http;

use Flarum\Http\UrlGenerator;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Gaps\Invites\InviteService;

/**
 * GET /invites/{code} — o link que se compartilha. Leva à página inicial
 * com o código no endereço, e o fórum abre a janela de cadastro já com o
 * convite ("Fulano convidou você"). Código inválido ou esgotado: só a
 * página inicial, sem erro — o link pode ter sido usado por outra pessoa.
 */
final class RedeemInviteController implements RequestHandlerInterface
{
    public function __construct(
        private readonly InviteService $invites,
        private readonly UrlGenerator $url,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $code = (string) Arr::get($request->getQueryParams(), 'code', '');
        $base = $this->url->to('forum')->base();

        if (! $this->invites->findUsable($code)) {
            return new RedirectResponse($base);
        }

        return new RedirectResponse($base.'/?canelaInvite='.rawurlencode($code));
    }
}
