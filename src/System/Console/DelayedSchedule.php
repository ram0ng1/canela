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

namespace Ramon\Canela\System\Console;

use Illuminate\Console\Scheduling\Event;

/** De hora em hora, sem sobrepor (dois ciclos não mandam a mesma mensagem). */
final class DelayedSchedule
{
    public function __invoke(Event $event): void
    {
        $event->hourly()->withoutOverlapping();
    }
}
