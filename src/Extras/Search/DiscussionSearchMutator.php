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
use Illuminate\Database\Eloquent\Builder;

/**
 * Ajustes da busca de tópicos que um filtro sozinho não consegue fazer.
 *
 * - `in:title` (`filter[canelaInTitle]`): o texto livre só vale no título. O
 *   filtro não recebe o texto (ele mora em `filter[q]`), mas o mutador recebe
 *   os critérios inteiros. A busca de texto do core continua rodando — ela
 *   aceita o tópico pelo título OU pelas postagens —, e aqui se exige que cada
 *   palavra apareça no título, o que deixa só os acertos de título.
 * - "Mais curtidos" (`sort=-canelaLikes`): curtidas da postagem de abertura, a
 *   mesma régua do Discourse para tópicos. Veja SortsByLikes.
 */
final class DiscussionSearchMutator
{
    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        $query = $state->getQuery();

        $this->restrictToTitle($query, $criteria);

        if (SortsByLikes::requested($criteria)) {
            SortsByLikes::addColumn($query, 'discussions.first_post_id');
        }
    }

    private function restrictToTitle(Builder $query, SearchCriteria $criteria): void
    {
        $filters = $criteria->filters;

        if (! array_key_exists('canelaInTitle', $filters) || ! is_string($filters['q'] ?? null)) {
            return;
        }

        $words = preg_split('/\s+/u', trim($filters['q'])) ?: [];

        foreach ($words as $word) {
            if ($word === '') {
                continue;
            }

            // Os curingas do LIKE vêm escapados: "50%" procura o texto "50%".
            $escaped = addcslashes($word, '\\%_');

            $query->where('discussions.title', 'like', "%{$escaped}%");
        }
    }
}
