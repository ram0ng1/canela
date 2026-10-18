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

namespace Ramon\Canela\Bookmarks\Access;

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * `Bookmark::whereVisibleTo($actor)`: só os do próprio ator. Um visitante não
 * tem marcadores, e a condição impossível evita consultar por `user_id` nulo.
 */
final class ScopeBookmarkVisibility
{
    public function __invoke(User $actor, Builder $query): void
    {
        if ($actor->isGuest()) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where('canela_bookmarks.user_id', $actor->id);
    }
}
