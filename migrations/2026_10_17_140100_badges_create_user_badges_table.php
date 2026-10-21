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
 * Cada concessão de um emblema a alguém.
 *
 * Os emblemas de concessão múltipla ("Resposta interessante", "Aniversário")
 * têm uma linha por vez; o `post_id` diz qual postagem rendeu o emblema. O
 * índice único em (emblema, usuário, postagem) impede a mesma postagem de
 * render o mesmo emblema duas vezes mesmo com dois processos concedendo ao
 * mesmo tempo; para as concessões sem postagem (NULL não colide num índice
 * único) quem garante é o BadgeGranter.
 *
 * Postagem apagada não leva o emblema junto: `nullOnDelete` — o emblema
 * continua e só perde o link.
 */
return Migration::createTable(
    'canela_user_badges',
    static function (Blueprint $table): void {
        $table->increments('id');
        $table->unsignedInteger('user_id');
        $table->unsignedInteger('badge_id');
        $table->unsignedInteger('post_id')->nullable();
        $table->dateTime('granted_at');

        $table->unique(['badge_id', 'user_id', 'post_id']);
        $table->index(['user_id', 'granted_at']);
        $table->index(['badge_id', 'granted_at']);

        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        $table->foreign('badge_id')->references('id')->on('canela_badges')->cascadeOnDelete();
        $table->foreign('post_id')->references('id')->on('posts')->nullOnDelete();
    }
);
