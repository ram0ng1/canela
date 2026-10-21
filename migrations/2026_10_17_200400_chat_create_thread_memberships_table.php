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
 * Quem acompanha cada fio e até onde leu.
 *
 * `notification_level`: 0 silenciado, 1 normal, 2
 * monitorando (conta não lidas), 3 acompanhando (notifica toda resposta).
 */
return Migration::createTable(
    'canela_chat_thread_memberships',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('thread_id');
        $table->unsignedInteger('user_id');
        $table->unsignedInteger('last_read_message_id')->nullable();
        $table->unsignedTinyInteger('notification_level')->default(2);
        $table->timestamps();

        $table->unique(['thread_id', 'user_id']);
        $table->index('user_id');

        $table->foreign('thread_id')->references('id')->on('canela_chat_threads')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
