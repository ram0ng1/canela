<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * Contador de visualizações do tópico.
 *
 * Fica na própria tabela de discussões (e não somado de canela_topic_views a
 * cada listagem) porque a lista mostra e ordena por ele: uma coluna com índice
 * é o único jeito de ordenar milhares de tópicos sem um GROUP BY por página.
 */
return [
    'up' => static function (Builder $schema): void {
        $schema->table('discussions', static function (Blueprint $table): void {
            $table->unsignedInteger('canela_view_count')->default(0);
            $table->index('canela_view_count', 'discussions_canela_view_count_index');
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->table('discussions', static function (Blueprint $table): void {
            $table->dropIndex('discussions_canela_view_count_index');
            $table->dropColumn('canela_view_count');
        });
    },
];
