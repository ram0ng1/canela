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

namespace Ramon\Canela\Assign;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\User\User;

/**
 * `filter[canelaAssigned]`: tópicos atribuídos a alguém. `me` é o ator;
 * fora isso, o nome de usuário. A lista "Atribuídos a mim" usa `me`.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class AssignedFilter implements FilterInterface
{
    #[\Override]
    public function getFilterKey(): string
    {
        return 'canelaAssigned';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $value = trim(is_array($value) ? (string) reset($value) : $value);
        $actor = $state->getActor();

        $id = $value === 'me'
            ? ($actor->isGuest() ? 0 : $actor->id)
            : (int) User::query()->where('username', $value)->value('id');

        $state->getQuery()->where('discussions.canela_assignee_id', $negate ? '!=' : '=', $id);
    }
}
