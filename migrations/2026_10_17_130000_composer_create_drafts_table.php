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
 * Rascunhos do composer: um por pessoa e por contexto
 * (tópico novo, resposta a um tópico, edição de um post). O índice único em
 * (user_id, draft_key) é o que deixa a API gravar por "upsert" — salvar de
 * novo o mesmo contexto substitui o rascunho em vez de empilhar outro.
 *
 * O conteúdo fica num JSON (título, texto, tags) porque cada contexto guarda
 * campos diferentes e nenhum deles é consultado pelo banco.
 */
return Migration::createTable(
    'canela_drafts',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('user_id');
        $table->string('draft_key', 100);
        $table->mediumText('data');
        $table->dateTime('updated_at');

        $table->unique(['user_id', 'draft_key']);
        $table->index(['user_id', 'updated_at']);
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
