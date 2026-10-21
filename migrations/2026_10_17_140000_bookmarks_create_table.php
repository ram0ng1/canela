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
 * Marcadores (bookmarks): cada usuário marca posts, com um nome
 * opcional e um lembrete.
 *
 * - Um marcador por usuário e post (o índice único): marcar de novo edita o
 *   que já existe.
 * - `reminded_at` separado de `reminder_at`: o comando agendado procura os
 *   lembretes vencidos que ainda não foram enviados, e trocar o horário zera o
 *   envio sem perder o histórico do anterior.
 * - As chaves estrangeiras apagam o marcador junto com o post ou o usuário —
 *   um marcador órfão não tem para onde levar.
 */
return Migration::createTable(
    'canela_bookmarks',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('user_id');
        $table->unsignedInteger('post_id');
        $table->string('name', 100)->nullable();
        $table->dateTime('reminder_at')->nullable();
        $table->dateTime('reminded_at')->nullable();
        $table->timestamps();

        $table->unique(['user_id', 'post_id']);
        // O comando agendado varre por aqui a cada poucos minutos.
        $table->index(['reminded_at', 'reminder_at']);

        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
    }
);
