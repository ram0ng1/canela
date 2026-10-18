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
 * Quem disse "Eu também" em cada tópico, como o `discourse_solved_shared_issues`
 * do Discourse: uma linha por pessoa por tópico. A chave primária é o próprio
 * par (tópico, pessoa): é ela que impede o voto duplo e serve a contagem; o
 * índice invertido atende "o que esta pessoa marcou". Apagar o tópico ou a
 * conta leva as linhas junto, como o `dependent: :delete_all` do plugin.
 */
return Migration::createTable(
    'canela_me_too',
    static function (Blueprint $table): void {
        $table->unsignedInteger('discussion_id');
        $table->unsignedInteger('user_id');
        $table->dateTime('created_at');

        $table->primary(['discussion_id', 'user_id']);
        $table->index(['user_id', 'discussion_id']);

        $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
