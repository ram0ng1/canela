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

use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\User\User;

/**
 * `filter[user]=<id ou nome de usuário>`. Aceita os dois porque a aba do
 * perfil tem o id, e uma URL escrita à mão tem o nome.
 *
 * @implements FilterInterface<\Flarum\Search\Database\DatabaseSearchState>
 */
final class UserFilter implements FilterInterface
{
    #[\Override]
    public function getFilterKey(): string
    {
        return 'user';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $ids = [];

        foreach ((array) $value as $identifier) {
            $identifier = trim((string) $identifier);

            $ids[] = ctype_digit($identifier)
                ? (int) $identifier
                : (int) User::query()->where('username', $identifier)->value('id');
        }

        $state->getQuery()->{$negate ? 'whereNotIn' : 'whereIn'}('canela_user_badges.user_id', $ids ?: [0]);
    }
}
