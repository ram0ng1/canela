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
 * As mensagens (`chat_messages` do Discourse).
 *
 * - `message` é o texto como foi digitado (é o que a edição mostra) e `cooked`
 *   o HTML já formatado: o chat é lido muito mais do que escrito, e formatar a
 *   cada leitura custaria o formatador inteiro por mensagem.
 * - `thread_id` sem chave estrangeira: o fio aponta para a mensagem original e
 *   a original aponta para o fio — com as duas chaves, nenhuma das linhas
 *   poderia ser criada primeiro.
 * - Exclusão é lógica (`deleted_at`/`deleted_by_id`), para a mensagem poder ser
 *   restaurada e a moderação ver o que foi apagado.
 * - O autor apagado vira nulo: a conversa continua legível, com "excluído(a)"
 *   no lugar do nome, como no Discourse.
 * - `updated_at` muda a cada edição, exclusão, reação ou fixação: é por ele
 *   que o modo sem tempo real (polling) descobre o que mudou.
 */
return Migration::createTable(
    'canela_chat_messages',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('channel_id');
        $table->unsignedInteger('user_id')->nullable();
        $table->unsignedInteger('thread_id')->nullable();
        $table->unsignedInteger('in_reply_to_id')->nullable();
        $table->mediumText('message');
        $table->mediumText('cooked');
        $table->unsignedInteger('last_editor_id')->nullable();
        $table->dateTime('edited_at')->nullable();
        $table->dateTime('deleted_at')->nullable();
        $table->unsignedInteger('deleted_by_id')->nullable();
        $table->timestamps();

        $table->index(['channel_id', 'id']);
        $table->index(['thread_id', 'id']);
        $table->index(['channel_id', 'updated_at']);
        $table->index('in_reply_to_id');
        $table->index('created_at');

        $table->foreign('channel_id')->references('id')->on('canela_chat_channels')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
    }
);
