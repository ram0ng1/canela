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

namespace Ramon\Canela\Chat\Access;

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;

/**
 * `Message::whereVisibleTo($actor)`: as mensagens dos canais que o ator
 * enxerga. Apagada, só para o autor e, num canal público, para a moderação —
 * para os outros ela some (404), como se nunca tivesse existido.
 */
final class ScopeMessageVisibility
{
    public function __construct(
        private readonly ChatAccess $access,
    ) {
    }

    /** @param Builder<Message> $query */
    public function __invoke(User $actor, Builder $query): void
    {
        $query->whereIn('canela_chat_messages.channel_id', Channel::query()->select('canela_chat_channels.id')->whereVisibleTo($actor));

        $actorId = (int) $actor->id;
        $moderates = $this->access->canModerate($actor);

        $query->where(static function (Builder $query) use ($actorId, $moderates) {
            $query->whereNull('canela_chat_messages.deleted_at')->orWhere('canela_chat_messages.user_id', $actorId);

            if ($moderates) {
                $query->orWhereIn(
                    'canela_chat_messages.channel_id',
                    Channel::query()->select('canela_chat_channels.id')->where('canela_chat_channels.type', Channel::TYPE_PUBLIC)
                );
            }
        });
    }
}
