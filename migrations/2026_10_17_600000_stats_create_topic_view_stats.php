<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Flarum\Database\Migration;
use Illuminate\Database\Schema\Blueprint;

/*
 * Visualizações por dia de cada tópico — a `topic_view_stats` do Discourse,
 * que desenha o gráfico "Visualizações recentes" do mapa do tópico.
 *
 * Uma linha por (tópico, dia), com anônimos e logados separados. O índice
 * único é o que deixa somar com um INSERT … ON DUPLICATE KEY UPDATE; o
 * segundo índice (dia, tópico) serve aos relatórios por período, como lá.
 *
 * Sem esta tabela o tema continua contando as visualizações no tópico; só o
 * gráfico fica sem dias para mostrar.
 */
return Migration::createTable(
    'canela_topic_view_stats',
    static function (Blueprint $table): void {
        $table->increments('id');
        $table->unsignedInteger('discussion_id');
        $table->date('date');
        $table->unsignedInteger('anonymous_views')->default(0);
        $table->unsignedInteger('logged_in_views')->default(0);

        $table->unique(['discussion_id', 'date']);
        $table->index(['date', 'discussion_id']);

        $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
    }
);
