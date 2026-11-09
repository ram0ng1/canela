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

namespace Ramon\Canela\Assign;

use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\System\Api\SystemUserPresenter;

/** `POST /api/canela/assign-assistant`: o botão "Criar o assistente" do admin. */
final class CreateAssistantController implements RequestHandlerInterface
{
    public function __construct(
        private readonly AssistantBot $bot,
        private readonly SettingsRepositoryInterface $settings,
        private readonly TranslatorInterface $translator,
        private readonly SystemUserPresenter $presenter,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        $locale = $this->settings->get('default_locale');
        $key = 'ramon-canela.admin.settings.gaps.assign_bot_bio';
        $bio = $this->translator->trans($key, [], null, is_string($locale) ? $locale : null);

        $user = $this->bot->create($bio === $key ? '' : $bio);

        return new JsonResponse(['data' => $this->presenter->present($user)]);
    }
}
