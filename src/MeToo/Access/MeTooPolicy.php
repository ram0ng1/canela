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

namespace Ramon\Canela\MeToo\Access;

use Flarum\Discussion\Discussion;
use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\MeToo\MeToo;

/**
 * `$actor->can('canelaMeToo', $discussion)`: marcar "Eu também" no tópico,
 * pelas regras de MeToo::canToggle (logado, não é o autor, pode responder, o
 * tópico aberto e nas tags escolhidas…).
 *
 * As duas respostas são forçadas:
 * - `forceDeny` quando não vale, e não `deny`: sem ele o Gate deixaria o
 *   administrador marcar o próprio tópico ou um tópico trancado;
 * - `forceAllow` quando vale, e não `allow`: a política do flarum/tags nega
 *   qualquer habilidade sem a permissão própria da tag restrita
 *   (`tag{id}.discussion.canelaMeToo`, que não existe), e a regra já pede o
 *   `reply` no tópico, que respeita as tags.
 *
 * Tirar o próprio voto não passa por aqui: vale sempre (ToggleMeToo).
 */
final class MeTooPolicy extends AbstractPolicy
{
    public const ABILITY = 'canelaMeToo';

    public function __construct(
        private readonly MeToo $meToo,
    ) {
    }

    public function canelaMeToo(User $actor, Discussion $discussion): string
    {
        return $this->meToo->canToggle($actor, $discussion) ? $this->forceAllow() : $this->forceDeny();
    }
}
