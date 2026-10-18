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

use Ramon\Canela\Badges\BadgeQueries;
use Ramon\Canela\Badges\Scope;

/**
 * Curtida nova (flarum/likes): Primeira curtida para quem curtiu; Boas-vindas
 * e as de N curtidas para o autor; e a revisão de nível dos dois, porque
 * curtidas dadas e recebidas são requisitos do nível 2.
 *
 * O evento chega tipado como `object` porque esta classe é carregada mesmo
 * com o flarum/likes desligado (o extend só a liga com a extensão ativa).
 */
final class LikeListener
{
    public function __construct(
        private readonly BadgeEvents $events,
    ) {
    }

    public function handle(object $event): void
    {
        $post = $event->post ?? null;

        if (! $post) {
            return;
        }

        $this->events->grant(BadgeQueries::TRIGGER_LIKE, Scope::posts([$post->id]));
        $this->events->review([$event->user ?? null, $post->user]);
    }
}
