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
 * Um dia de visita por linha: daqui saem os
 * "Dias visitados", o "Tempo de leitura" e as "Postagens lidas" do resumo do
 * perfil. Por dia (e não por acesso) para a tabela crescer no máximo uma
 * linha por pessoa por dia, e para a soma do perfil ser um SUM simples.
 */
return Migration::createTable(
    'canela_user_visits',
    static function (Blueprint $table): void {
        $table->increments('id');
        $table->unsignedInteger('user_id');
        $table->date('visited_at');
        $table->unsignedInteger('posts_read')->default(0);
        $table->unsignedInteger('time_read')->default(0);
        $table->boolean('mobile')->default(false);

        $table->unique(['user_id', 'visited_at']);

        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
