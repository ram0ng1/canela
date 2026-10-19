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

namespace Ramon\Canela\Support;

use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder;

/**
 * Ordena uma coluna que aceita NULL do mesmo jeito em todos os bancos: o NULL
 * conta como o menor valor (primeiro no `asc`, último no `desc`), como no
 * MySQL, MariaDB e SQLite. O PostgreSQL faz o contrário por padrão, e quem
 * nunca entrou viria antes de quem esteve aqui agora há pouco.
 */
final class NullOrder
{
    /** @param Builder|EloquentBuilder<*> $query */
    public static function orderBy(Builder|EloquentBuilder $query, string $column, string $direction = 'asc'): void
    {
        $direction = strtolower($direction) === 'desc' ? 'desc' : 'asc';
        $base = $query instanceof EloquentBuilder ? $query->getQuery() : $query;
        $wrapped = $base->getGrammar()->wrap($column);

        $base->orderByRaw("CASE WHEN $wrapped IS NULL THEN 0 ELSE 1 END $direction")->orderBy($column, $direction);
    }
}
