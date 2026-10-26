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

namespace Ramon\Canela\MeToo\Realtime;

use Illuminate\Contracts\Queue\Queue;
use Ramon\Canela\MeToo\Event\Toggled;
use Ramon\Canela\Support\Log;

/**
 * Ouvinte de Toggled, registrado só com o flarum/realtime habilitado (ver
 * extend/metoo.php): põe na fila a entrega da contagem nova. A marcação já
 * foi gravada, então uma falha aqui só vira log — nunca um erro no clique.
 */
final class BroadcastMeToo
{
    public function __construct(
        private readonly Queue $queue
    ) {
    }

    public function handle(Toggled $event): void
    {
        try {
            $this->queue->push(new MeTooPushJob((int) $event->discussion->id, (int) $event->actor->id));
        } catch (\Throwable $error) {
            Log::warning('me too: entrega em tempo real falhou: '.$error->getMessage());
        }
    }
}
