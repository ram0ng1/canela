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

namespace Ramon\Canela\Badges\Listener;

use Flarum\Discussion\Event\UserRead;
use Ramon\Canela\Badges\BadgeQueries;
use Ramon\Canela\Badges\Scope;

/**
 * Leitura de uma discussão: o Leitor(a), quando o tópico é longo e a pessoa
 * chegou ao fim, e a revisão de nível — ler é o que leva ao nível 1.
 */
final class ReadListener
{
    /** O mesmo corte do emblema: só tópico longo pode render o Leitor(a). */
    private const READER_MIN_POSTS = 100;

    public function __construct(
        private readonly BadgeEvents $events,
    ) {
    }

    public function handle(UserRead $event): void
    {
        $state = $event->state;
        $user = $state->user;
        $discussion = $state->discussion;

        if (! $user) {
            return;
        }

        if ($discussion && $discussion->comment_count > self::READER_MIN_POSTS && $state->last_read_post_number >= $discussion->last_post_number) {
            $this->events->grant(BadgeQueries::TRIGGER_READ, Scope::users([$user->id]));
        }

        $this->events->reviewThrottled($user);
    }
}
