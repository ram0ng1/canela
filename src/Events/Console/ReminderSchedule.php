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

namespace Ramon\Canela\Events\Console;

use Illuminate\Console\Scheduling\Event;

/**
 * A cada cinco minutos: o lembrete chega no máximo cinco minutos depois do
 * horário escolhido no admin (o mesmo passo dos lembretes de marcador).
 */
final class ReminderSchedule
{
    public function __invoke(Event $event): void
    {
        $event->everyFiveMinutes()->withoutOverlapping();
    }
}
