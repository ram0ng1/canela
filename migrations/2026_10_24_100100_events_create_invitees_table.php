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
 * A presença de cada pessoa num evento: vou, interessado ou não vou. Uma linha
 * por pessoa e evento (o índice único): responder de novo troca a resposta.
 */
return Migration::createTable(
    'canela_event_invitees',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('event_id');
        $table->unsignedInteger('user_id');
        $table->string('status', 20);
        $table->timestamps();

        $table->unique(['event_id', 'user_id']);
        $table->index(['event_id', 'status']);
        $table->index('user_id');

        $table->foreign('event_id')->references('id')->on('canela_events')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
