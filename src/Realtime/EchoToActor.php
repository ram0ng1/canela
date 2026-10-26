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

namespace Ramon\Canela\Realtime;

use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Contracts\Queue\Queue;
use Ramon\Canela\Support\Log;

/**
 * Ouvinte das mudanças num post que o flarum/realtime avisa a todos menos a
 * quem as fez (curtir, reagir, editar). Registrado só com o realtime
 * habilitado (extend/realtime.php). Põe na fila o envio para o canal
 * privado de quem agiu; o EchoToActorJob decide se há para quem mandar.
 * A ação já foi gravada, então uma falha aqui só vira log.
 */
final class EchoToActor
{
    public function __construct(
        private readonly Queue $queue
    ) {
    }

    /**
     * @param  string  $eventName  O nome que o JS do realtime escuta (o mesmo do envio original).
     */
    public function push(string $eventName, ?Post $post, ?User $actor): void
    {
        if (! $post || ! $actor || ! $actor->exists || $actor->isGuest()) {
            return;
        }

        try {
            $this->queue->push(new EchoToActorJob($eventName, (int) $post->id, (int) $actor->id));
        } catch (\Throwable $error) {
            Log::warning('realtime: envio a quem agiu falhou: '.$error->getMessage());
        }
    }
}
