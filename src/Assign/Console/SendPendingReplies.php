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

namespace Ramon\Canela\Assign\Console;

use Illuminate\Console\Command;
use Illuminate\Console\Scheduling\Event;
use Ramon\Canela\Assign\AssistantQueue;

/**
 * As respostas do assistente com espera, na fila síncrona
 * (`php flarum canela:assistant-replies`). Roda a cada minuto pelo agendador
 * do Flarum (`php flarum schedule:run` no cron).
 */
final class SendPendingReplies extends Command
{
    /** @var string */
    protected $signature = 'canela:assistant-replies';

    /** @var string */
    protected $description = 'Publica as respostas do assistente de IA cuja espera já passou.';

    public static function schedule(Event $event): void
    {
        $event->everyMinute()->withoutOverlapping();
    }

    public function handle(AssistantQueue $queue): int
    {
        $this->info('Respostas publicadas: '.$queue->releaseDue().'.');

        return self::SUCCESS;
    }
}
