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
 * Push no navegador (Ramon\Canela\Push): um registro por aparelho em que a
 * pessoa ligou as notificações. O endpoint é longo (texto); o hash dele é
 * a chave única, para o mesmo aparelho não entrar duas vezes.
 */
return Migration::createTable(
    'canela_push_subscriptions',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('user_id');
        $table->char('endpoint_hash', 64)->unique();
        $table->text('endpoint');
        $table->string('public_key', 255);
        $table->string('auth_token', 255);
        $table->timestamps();

        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
