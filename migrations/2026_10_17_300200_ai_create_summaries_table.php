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
 * Os resumos de IA de cada tópico: o resumo completo ("Resumir", no mapa do
 * tópico) e o resumo curto (gist) que aparece na lista.
 *
 * Um registro por tópico. O número do último post resumido diz se o resumo
 * está desatualizado ("O resumo está desatualizado") sem
 * guardar a lista de posts. Some junto com o tópico.
 */
return Migration::createTable(
    'canela_ai_summaries',
    function (Blueprint $table) {
        $table->unsignedInteger('discussion_id')->primary();
        $table->text('summary')->nullable();
        $table->unsignedInteger('summary_post_number')->nullable();
        $table->unsignedInteger('summary_post_count')->nullable();
        $table->string('summary_model', 100)->nullable();
        $table->dateTime('summary_updated_at')->nullable();
        $table->string('gist', 500)->nullable();
        $table->unsignedInteger('gist_post_number')->nullable();
        $table->dateTime('gist_updated_at')->nullable();

        $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
    }
);
