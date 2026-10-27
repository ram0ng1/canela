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
use Ramon\Canela\Chat\ChatSettings;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Thread;

/**
 * `Thread::whereVisibleTo($actor)`: os fios dos canais que o ator enxerga,
 * com os fios ligados no canal e no admin. Desligados, o fio responde 404.
 */
final class ScopeThreadVisibility
{
    public function __construct(
        private readonly ChatSettings $settings,
    ) {
    }

    /** @param Builder<Thread> $query */
    public function __invoke(User $actor, Builder $query): void
    {
        if (! $this->settings->bool(ChatSettings::THREADS_ENABLED)) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->whereIn(
            'canela_chat_threads.channel_id',
            Channel::query()->select('canela_chat_channels.id')->where('canela_chat_channels.threading_enabled', true)->whereVisibleTo($actor)
        );
    }
}
