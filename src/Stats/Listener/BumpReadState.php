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

namespace Ramon\Canela\Stats\Listener;

use Flarum\Discussion\Event\UserRead;
use Flarum\Post\Event\Posted;
use Flarum\User\Event\Saving;
use Illuminate\Contracts\Events\Dispatcher;
use Ramon\Canela\Stats\ReadStateVersion;

/**
 * O que muda o que a pessoa já leu: abrir um tópico, marcar tudo como lido e
 * postar. Cada um troca a versão dela, e as contagens em cache se refazem.
 */
final class BumpReadState
{
    public function __construct(
        private readonly ReadStateVersion $version,
    ) {
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(UserRead::class, fn (UserRead $event) => $this->version->bump((int) $event->state->user_id));

        $events->listen(Posted::class, fn (Posted $event) => $this->version->bump((int) $event->post->user_id));

        $events->listen(Saving::class, function (Saving $event): void {
            if ($event->user->exists && $event->user->isDirty('marked_all_as_read_at')) {
                $this->version->bump((int) $event->user->id);
            }
        });
    }
}
