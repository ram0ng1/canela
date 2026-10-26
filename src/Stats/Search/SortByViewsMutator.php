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
 * `view_count`, que não é nossa: a coluna é `canela_view_count`, e
 * `view_count` é justamente a coluna real do fof/discussion-views. Os
 * mutadores rodam depois do applySort, então aqui só trocamos a coluna da
 * cláusula de ordenação que o core já montou, qualificada pela tabela — sem
 * apelido no SELECT, que colidiria com a coluna da outra extensão (ORDER BY
 * ambíguo no PostgreSQL e o valor errado hidratado no modelo).
 */
final class SortByViewsMutator
{
    public const SORT = 'viewCount';

    private const CORE_COLUMN = 'view_count';

    private const COLUMN = 'discussions.canela_view_count';

    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        if (! is_array($criteria->sort) || ! array_key_exists(self::SORT, $criteria->sort)) {
            return;
        }

        $base = $state->getQuery()->getQuery();

        if (empty($base->orders)) {
            return;
        }

        foreach ($base->orders as $i => $order) {
            if (($order['column'] ?? null) === self::CORE_COLUMN) {
                $base->orders[$i]['column'] = self::COLUMN;
            }
        }
    }
}
