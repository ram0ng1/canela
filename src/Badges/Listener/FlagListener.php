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

/** Sinalização nova (flarum/flags): Primeiro sinalizador para quem sinalizou. */
final class FlagListener
{
    public function __construct(
        private readonly BadgeEvents $events,
    ) {
    }

    public function handle(object $event): void
    {
        $userId = $event->flag->user_id ?? null;

        if ($userId) {
            $this->events->grant(BadgeQueries::TRIGGER_FLAG, Scope::users([(int) $userId]));
        }
    }
}
