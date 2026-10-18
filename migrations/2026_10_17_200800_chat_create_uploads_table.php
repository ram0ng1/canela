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
 * Imagens anexadas às mensagens. O envio acontece antes da mensagem existir (a
 * miniatura aparece no composer enquanto se digita), então `message_id` começa
 * nulo; o agendador apaga os envios que nunca viraram mensagem.
 *
 * O arquivo em disco é apagado pelo código antes da linha — o banco não sabe
 * apagar arquivos —, por isso não há chave estrangeira para a mensagem.
 */
return Migration::createTable(
    'canela_chat_uploads',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('user_id')->nullable();
        $table->unsignedInteger('message_id')->nullable();
        $table->string('path', 255);
        $table->string('original_name', 255);
        $table->string('mime', 100);
        $table->unsignedInteger('size');
        $table->unsignedSmallInteger('width')->nullable();
        $table->unsignedSmallInteger('height')->nullable();
        $table->dateTime('created_at')->nullable();

        $table->index('message_id');
        $table->index(['user_id', 'created_at']);

        $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
    }
);
