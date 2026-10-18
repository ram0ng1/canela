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
 * Histórico de edições: uma linha por edição, com o texto que existia ANTES
 * dela (o atual mora na própria postagem).
 *
 * - `post_id` apaga em cascata: postagem excluída leva o histórico junto, e
 *   nada fica órfão guardando texto de algo que não existe mais.
 * - `user_id` fica nulo quando o editor é excluído, para a versão continuar
 *   no histórico (só sem o nome de quem editou).
 * - `content` é `mediumText`, a mesma coluna das postagens do core.
 */
return Migration::createTable(
    'canela_post_revisions',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('post_id');
        $table->unsignedInteger('user_id')->nullable();
        $table->unsignedInteger('revision');
        $table->mediumText('content');
        $table->dateTime('created_at');

        $table->unique(['post_id', 'revision']);
        $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
    }
);
