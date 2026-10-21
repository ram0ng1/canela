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
 * Quem participa de cada canal.
 *
 * - `following`: entrou no canal. Sair de um canal público só desliga isto, e
 *   a linha guarda até onde a pessoa leu para quando ela voltar.
 * - `notification_level`: 0 nunca, 1 só menções, 2 sempre.
 * - `last_read_message_id`: tudo depois dele é "não lido". As contagens de não
 *   lidas e de menções saem daqui, numa consulta só para todos os canais.
 * - `last_viewed_pins_at`: para o pontinho de "fixadas novas".
 */
return Migration::createTable(
    'canela_chat_memberships',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('channel_id');
        $table->unsignedInteger('user_id');
        $table->boolean('following')->default(true);
        $table->boolean('muted')->default(false);
        $table->unsignedTinyInteger('notification_level')->default(1);
        $table->boolean('starred')->default(false);
        $table->unsignedInteger('last_read_message_id')->nullable();
        $table->dateTime('last_viewed_at')->nullable();
        $table->dateTime('last_viewed_pins_at')->nullable();
        $table->timestamps();

        $table->unique(['channel_id', 'user_id']);
        $table->index(['user_id', 'following']);

        $table->foreign('channel_id')->references('id')->on('canela_chat_channels')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
