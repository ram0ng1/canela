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

namespace Ramon\Canela\Extras\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;

/**
 * `filter[canelaBookmarked]` na busca de postagens: as postagens que eu
 * marquei. A regra é a de BookmarkedFilter, só que medida pela postagem.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class PostBookmarkedFilter implements FilterInterface
{
    private readonly BookmarkedFilter $filter;

    public function __construct()
    {
        $this->filter = new BookmarkedFilter('posts');
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return BookmarkedFilter::KEY;
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $this->filter->filter($state, $value, $negate);
    }
}
