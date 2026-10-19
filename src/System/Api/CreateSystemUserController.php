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

namespace Ramon\Canela\System\Api;

use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\System\SystemUser;

/**
 * `POST /api/canela/system-user`: o botão "Criar usuário do sistema" do
 * admin. Se já existe um, devolve o mesmo (dois cliques não criam dois).
 */
final class CreateSystemUserController implements RequestHandlerInterface
{
    public function __construct(
        private readonly SystemUser $system,
        private readonly SettingsRepositoryInterface $settings,
        private readonly TranslatorInterface $translator,
        private readonly SystemUserPresenter $presenter,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $user = $this->system->get();

        if (! $user) {
            $locale = $this->settings->get('default_locale');
            $bio = $this->translator->trans('ramon-canela.admin.system_user.bio', [], null, is_string($locale) ? $locale : null);

            $user = $this->system->create($bio === 'ramon-canela.admin.system_user.bio' ? '' : $bio);
        }

        return new JsonResponse(['data' => $this->presenter->present($user)]);
    }
}
