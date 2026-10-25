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
 * Eventos: o [event] do primeiro post, um por post.
 *
 * - As datas ficam em UTC; `timezone` é o fuso de quem criou, para mostrar a
 *   hora original e calcular a recorrência no horário local (horário de verão).
 * - Os contadores de presença ficam aqui para a lista e o cartão não contarem
 *   os convidados a cada pedido.
 * - `reminded_start` é a ocorrência que já teve lembrete: com recorrência, a
 *   próxima ocorrência tem outro início e ganha o próprio lembrete.
 * - As chaves estrangeiras apagam o evento junto com o post e a discussão.
 */
return Migration::createTable(
    'canela_events',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('post_id')->unique();
        $table->unsignedInteger('discussion_id');
        $table->unsignedInteger('user_id')->nullable();
        $table->string('name', 200)->nullable();
        $table->dateTime('starts_at');
        $table->dateTime('ends_at')->nullable();
        $table->string('timezone', 64)->nullable();
        $table->string('status', 20)->default('public');
        $table->string('recurrence', 30)->nullable();
        $table->dateTime('recurrence_until')->nullable();
        $table->string('url', 1000)->nullable();
        $table->string('location', 255)->nullable();
        $table->text('description')->nullable();
        $table->unsignedInteger('max_attendees')->nullable();
        $table->boolean('chat_enabled')->default(false);
        $table->unsignedInteger('chat_channel_id')->nullable();
        $table->unsignedInteger('going_count')->default(0);
        $table->unsignedInteger('interested_count')->default(0);
        $table->unsignedInteger('not_going_count')->default(0);
        $table->dateTime('reminded_start')->nullable();
        $table->timestamps();

        $table->index('discussion_id');
        // "Próximos eventos" e o lembrete varrem por aqui.
        $table->index(['starts_at', 'recurrence']);

        $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
        $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
    }
);
