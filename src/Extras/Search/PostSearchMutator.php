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
use Flarum\Search\SearchCriteria;

/**
 * "Mais curtidos" na busca de postagens (`sort=-canelaLikes`): as curtidas da
 * própria postagem. Veja SortsByLikes.
 */
final class PostSearchMutator
{
    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        if (SortsByLikes::requested($criteria)) {
            SortsByLikes::addColumn($state->getQuery(), 'posts.id');
        }
    }
}
