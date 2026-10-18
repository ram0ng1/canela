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

namespace Ramon\Canela\Stats\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\SearchCriteria;

/**
 * Faz `sort=-viewCount` funcionar também na busca.
 *
 * Quando a listagem passa pelo buscador (página inicial, busca, tags), o core
 * ignora a coluna declarada no SortColumn e ordena por `snake_case` do nome —
 * `view_count`, que não existe: a coluna é `canela_view_count`. Um apelido no
 * SELECT dá a esse nome um valor, e o ORDER BY do core passa a funcionar.
 */
final class SortByViewsMutator
{
    public const SORT = 'viewCount';

    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        if (! is_array($criteria->sort) || ! array_key_exists(self::SORT, $criteria->sort)) {
            return;
        }

        $query = $state->getQuery();

        // Com o SELECT vazio, o addSelect deixaria só o apelido e o modelo
        // perderia as próprias colunas.
        if (empty($query->getQuery()->columns)) {
            $query->select('discussions.*');
        }

        $query->addSelect('discussions.canela_view_count as view_count');
    }
}
