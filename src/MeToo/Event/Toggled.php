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

namespace Ramon\Canela\MeToo\Event;

use Flarum\Discussion\Discussion;
use Flarum\User\User;

/**
 * Alguém marcou ou desmarcou "Eu também" num tópico. Disparado pelo
 * controlador depois de gravar; hoje quem ouve é a entrega em tempo real
 * (só com o flarum/realtime habilitado), que leva a contagem nova a quem está
 * com o tópico aberto.
 */
final class Toggled
{
    public function __construct(
        public readonly Discussion $discussion,
        public readonly User $actor,
        public readonly bool $mine,
        public readonly int $count,
    ) {
    }
}
