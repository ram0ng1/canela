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

namespace Ramon\Canela\Chat\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatSettings;
use Ramon\Canela\Chat\Realtime\ChatBroadcaster;

/**
 * `canelaChat` no payload do fórum: o que o ator pode fazer no chat e os
 * limites do admin, para o front-end decidir o que mostrar sem uma ida à API.
 *
 * Só lê configurações e os grupos do ator — nada das tabelas do chat: o fórum
 * precisa abrir mesmo antes de as migrations rodarem.
 */
final class ForumChatAttributes
{
    public function __construct(
        private readonly ChatAccess $access,
        private readonly ChatBroadcaster $broadcaster,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('canelaChat')
                ->get(fn (object $model, Context $context) => $this->capabilities($context)),
        ];
    }

    /** @return array<string, mixed> */
    private function capabilities(Context $context): array
    {
        $settings = $this->access->settings();

        if (! $settings->enabled()) {
            return ['enabled' => false];
        }

        $actor = $context->getActor();

        return [
            'enabled' => true,
            // Pode usar, mas desligou nas preferências: o fórum oferece religar.
            'allowed' => $this->access->allowed($actor),
            'canUse' => $this->access->canUse($actor),
            'canDirectMessage' => $this->access->canDirectMessage($actor),
            'canCreateChannel' => $this->access->canCreateChannel($actor),
            'canModerate' => $this->access->canModerate($actor),
            'threads' => $settings->bool(ChatSettings::THREADS_ENABLED),
            'uploads' => $settings->bool(ChatSettings::UPLOADS_ENABLED),
            'pins' => $settings->bool(ChatSettings::PINS_ENABLED),
            'sidebar' => $settings->bool(ChatSettings::SIDEBAR),
            'maxMessageLength' => $settings->maxMessageLength(),
            'dmMaxUsers' => $settings->dmMaxUsers(),
            'uploadMaxKb' => $settings->uploadMaxKb(),
            'pollSeconds' => $settings->pollSeconds(),
            'retentionDays' => $settings->int(ChatSettings::RETENTION_DAYS),
            'dmRetentionDays' => $settings->int(ChatSettings::DM_RETENTION_DAYS),
            'realtime' => $this->broadcaster->available(),
        ];
    }
}
