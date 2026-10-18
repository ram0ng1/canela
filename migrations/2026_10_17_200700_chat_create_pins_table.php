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
 * Mensagens fixadas no canal (`chat_pinned_messages` do Discourse, até 20 por
 * canal). Uma mensagem só pode ser fixada uma vez.
 */
return Migration::createTable(
    'canela_chat_pins',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('channel_id');
        $table->unsignedInteger('message_id');
        $table->unsignedInteger('pinned_by_id')->nullable();
        $table->timestamps();

        $table->unique('message_id');
        $table->index(['channel_id', 'created_at']);

        $table->foreign('channel_id')->references('id')->on('canela_chat_channels')->cascadeOnDelete();
        $table->foreign('message_id')->references('id')->on('canela_chat_messages')->cascadeOnDelete();
        $table->foreign('pinned_by_id')->references('id')->on('users')->nullOnDelete();
    }
);
