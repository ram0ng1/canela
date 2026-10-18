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

use Flarum\Search\SearchCriteria;
use Illuminate\Database\Eloquent\Builder;

/**
 * Ordenação "mais curtidos" da busca (`sort=-canelaLikes`).
 *
 * O buscador do core não usa as classes de ordenação do recurso: ele ordena
 * pela coluna `snake_case` do nome pedido. Então a ordenação é registrada no
 * recurso só para passar na validação, e os mutadores de busca põem a coluna
 * `canela_likes` no SELECT quando ela é pedida.
 */
final class SortsByLikes
{
    public const SORT = 'canelaLikes';

    public const COLUMN = 'canela_likes';

    public static function requested(SearchCriteria $criteria): bool
    {
        return is_array($criteria->sort) && array_key_exists(self::SORT, $criteria->sort);
    }

    /**
     * A contagem de curtidas como coluna `canela_likes`, para a postagem cujo
     * id está em `$postIdColumn`.
     *
     * `addSelect` com chave, e não `selectRaw`: com o SELECT ainda vazio o
     * Laravel põe `tabela.*` antes da subconsulta; com `selectRaw` sobraria só
     * a contagem, sem as colunas do modelo.
     */
    public static function addColumn(Builder $query, string $postIdColumn): void
    {
        $query->addSelect([
            self::COLUMN => static function ($sub) use ($postIdColumn): void {
                $sub->selectRaw('count(*)')
                    ->from('post_likes')
                    ->whereColumn('post_likes.post_id', $postIdColumn);
            },
        ]);
    }
}
