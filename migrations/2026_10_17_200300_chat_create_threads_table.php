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
 * Fios (threads): a conversa paralela que nasce da resposta a uma mensagem,
 * nos canais com fios ligados (`chat_threads` do Discourse).
 *
 * A mensagem original é única por fio, e o fio some com ela. `replies_count` e
 * `last_message_id` alimentam o indicador "3 respostas" debaixo da original
 * sem contar as respostas a cada leitura do canal.
 */
return Migration::createTable(
    'canela_chat_threads',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('channel_id');
        $table->unsignedInteger('original_message_id');
        $table->unsignedInteger('original_message_user_id')->nullable();
        $table->string('title', 100)->nullable();
        $table->unsignedInteger('last_message_id')->nullable();
        $table->unsignedInteger('replies_count')->default(0);
        $table->unsignedTinyInteger('status')->default(0);
        $table->timestamps();

        $table->unique('original_message_id');
        $table->index(['channel_id', 'last_message_id']);

        $table->foreign('channel_id')->references('id')->on('canela_chat_channels')->cascadeOnDelete();
        $table->foreign('original_message_id')->references('id')->on('canela_chat_messages')->cascadeOnDelete();
    }
);
