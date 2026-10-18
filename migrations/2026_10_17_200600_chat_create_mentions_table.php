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
 * Quem foi mencionado em cada mensagem (@fulano, @here, @all). É daqui que sai
 * o contador de menções não lidas de cada canal — o número verde do cabeçalho e
 * da barra lateral — sem varrer o texto das mensagens.
 */
return Migration::createTable(
    'canela_chat_mentions',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('message_id');
        $table->unsignedInteger('user_id');
        $table->string('kind', 10)->default('user');
        $table->dateTime('created_at')->nullable();

        $table->unique(['message_id', 'user_id']);
        $table->index(['user_id', 'message_id']);

        $table->foreign('message_id')->references('id')->on('canela_chat_messages')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
