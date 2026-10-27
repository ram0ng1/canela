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

namespace Ramon\Canela\Ai\Access;

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * `Conversation::whereVisibleTo($actor)`: só as conversas do próprio ator.
 * Nem administradores leem as conversas dos outros com o bot. Um visitante
 * não tem conversas, e a condição impossível evita consultar por `user_id`
 * nulo.
 */
final class ScopeConversationVisibility
{
    public function __invoke(User $actor, Builder $query): void
    {
        if ($actor->isGuest()) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where('canela_ai_conversations.user_id', $actor->id);
    }
}
