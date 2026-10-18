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

namespace Ramon\Canela\Badges;

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Quais concessões alguém pode ver: as de emblemas ligados (o admin vê
 * todas), de usuários que essa pessoa pode ver. Num lugar só porque o recurso
 * (show, inclusões) e o searcher (listagem) precisam da mesma regra.
 */
final class UserBadgeVisibility
{
    public static function apply(Builder $query, User $actor): void
    {
        if (! $actor->isAdmin()) {
            $query->whereIn(
                'canela_user_badges.badge_id',
                Badge::query()->where('enabled', true)->select('id')->toBase()
            );
        }

        $query->whereIn(
            'canela_user_badges.user_id',
            User::query()->whereVisibleTo($actor)->select('users.id')->toBase()
        );
    }
}
