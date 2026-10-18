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

namespace Ramon\Canela\Chat\Listener;

use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Thread;

/**
 * Apagar uma tag apaga os canais dela, como apagar a categoria no Discourse:
 * um canal "da tag" sem a tag não teria mais quem pudesse vê-lo (a segurança
 * dele era a dela).
 */
final class DeleteTagChannels
{
    public function __construct(
        private readonly ChatService $service,
    ) {
    }

    public function __invoke(object $event): void
    {
        $tagId = (int) ($event->tag->id ?? 0);

        if (! $tagId) {
            return;
        }

        try {
            foreach (Channel::query()->where('tag_id', $tagId)->get() as $channel) {
                $this->service->purgeUploads(Message::query()->where('channel_id', $channel->id)->pluck('id')->all());
                Thread::query()->where('channel_id', $channel->id)->delete();
                Message::query()->where('channel_id', $channel->id)->delete();
                $channel->delete();
            }
        } catch (\Throwable $error) {
            // Tabelas do chat ainda não migradas: apagar a tag não pode falhar por isso.
            error_log('[ramon/canela] chat: canais da tag não apagados: '.$error->getMessage());
        }
    }
}
