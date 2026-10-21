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
 * Quem entrou por qual convite — o "Convidado por". Um usuário
 * entra por um convite só (a chave primária é o usuário).
 */
return Migration::createTable(
    'canela_invite_redemptions',
    function (Blueprint $table) {
        $table->unsignedInteger('user_id')->primary();
        $table->unsignedInteger('invite_id');
        $table->dateTime('created_at')->nullable();

        $table->index('invite_id');
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        $table->foreign('invite_id')->references('id')->on('canela_invites')->cascadeOnDelete();
    }
);
