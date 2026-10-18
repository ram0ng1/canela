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

namespace Ramon\Canela\Badges\Search;

use Flarum\Search\Database\AbstractSearcher;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Badges\UserBadge;
use Ramon\Canela\Badges\UserBadgeVisibility;

/** A listagem de concessões, com os filtros `user` e `badge`. */
final class UserBadgeSearcher extends AbstractSearcher
{
    #[\Override]
    public function getQuery(User $actor): Builder
    {
        // Em instrução separada: o `select` repassado ao query builder altera a
        // mesma consulta, e `$query` continua um Builder do Eloquent.
        $query = UserBadge::query();
        $query->select('canela_user_badges.*');

        UserBadgeVisibility::apply($query, $actor);

        return $query;
    }
}
