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

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Thread;

/**
 * O que o ator pode num fio (`$actor->can('…', $thread)`).
 *
 * - `view`: quem enxerga o canal, com os fios ligados no canal e no admin.
 * - `rename`: o título é de quem abriu o fio e da moderação do canal.
 */
final class ThreadPolicy extends AbstractPolicy
{
    public function __construct(
        private readonly ChatAccess $access,
    ) {
    }

    public function view(User $actor, Thread $thread): bool
    {
        $channel = $this->channel($thread);

        return $channel !== null && $this->access->threadsOn($channel) && $actor->can('view', $channel);
    }

    public function rename(User $actor, Thread $thread): bool
    {
        $channel = $this->channel($thread);

        return $channel !== null
            && ($thread->original_message_user_id === $actor->id || $actor->can('moderate', $channel));
    }

    private function channel(Thread $thread): ?Channel
    {
        /** @var Channel|null */
        return $thread->channel;
    }
}
