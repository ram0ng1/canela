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

namespace Ramon\Canela\Gaps\Invites\Access;

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * `Invite::whereVisibleTo($actor)`: só os convites do próprio ator. O de outra
 * pessoa fica de fora da lista e responde 404 (e não 403) a quem tenta
 * apagá-lo, para nem confirmar que ele existe. Visitante não tem convites.
 */
final class ScopeInviteVisibility
{
    public function __invoke(User $actor, Builder $query): void
    {
        if ($actor->isGuest()) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where('canela_invites.user_id', $actor->id);
    }
}
