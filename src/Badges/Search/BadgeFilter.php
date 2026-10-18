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

/**
 * `filter[badge]=<id>`: quem ganhou um emblema (a página /badges/:id).
 *
 * @implements FilterInterface<\Flarum\Search\Database\DatabaseSearchState>
 */
final class BadgeFilter implements FilterInterface
{
    #[\Override]
    public function getFilterKey(): string
    {
        return 'badge';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $ids = array_map('intval', (array) $value);

        $state->getQuery()->{$negate ? 'whereNotIn' : 'whereIn'}('canela_user_badges.badge_id', $ids ?: [0]);
    }
}
