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
 * Reações com emoji. O emoji é guardado como o caractere (não o atalho
 * ":heart:"), que é o que o seletor do tema e o flarum/emoji produzem. Um mesmo
 * emoji só uma vez por pessoa em cada mensagem (o índice único).
 */
return Migration::createTable(
    'canela_chat_reactions',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('message_id');
        $table->unsignedInteger('user_id');
        $table->string('emoji', 64);
        $table->dateTime('created_at')->nullable();

        $table->unique(['message_id', 'user_id', 'emoji']);
        $table->index('user_id');

        $table->foreign('message_id')->references('id')->on('canela_chat_messages')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
