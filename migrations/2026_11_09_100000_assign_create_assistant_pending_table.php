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
 * As respostas do assistente que esperam a vez (AssistantQueue), quando o
 * fórum usa a fila síncrona: o agendador publica cada uma no horário.
 */
return Migration::createTable(
    'canela_assistant_pending',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('discussion_id');
        $table->unsignedInteger('actor_id');
        $table->unsignedInteger('post_id')->nullable();
        $table->dateTime('due_at')->index();

        $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
        $table->foreign('actor_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
