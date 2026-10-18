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

namespace Ramon\Canela\Ai\Console;

use Illuminate\Console\Scheduling\Event;

/**
 * De hora em hora, sem sobrepor: uma rodada lenta (a API do provedor
 * demorando) não pode começar os mesmos tópicos que a próxima.
 */
final class HourlySchedule
{
    public function __invoke(Event $event): void
    {
        $event->hourly()->withoutOverlapping();
    }
}
