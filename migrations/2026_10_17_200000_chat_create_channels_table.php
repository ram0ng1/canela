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
 * Canais do chat.
 *
 * - `type`: `public` (canal aberto, avulso ou ligado a uma tag — a
 *   "categoria") ou `direct` (mensagem direta, 1:1 ou em grupo).
 * - `tag_id` sem chave estrangeira: a tabela `tags` só existe com o
 *   flarum/tags instalado, e o canal de uma tag apagada é removido pelo
 *   ouvinte do evento da tag, não pelo banco.
 * - `direct_key`: os ids dos participantes em ordem ("1,5,9"). O índice único
 *   impede duas conversas diretas com as mesmas pessoas — abrir de novo uma MD
 *   com alguém reaproveita a que já existe.
 * - `status`: 0 aberto, 1 somente leitura, 2 fechado, 3 arquivado.
 * - `last_message_id` e as contagens são desnormalizados: a lista de canais e
 *   o contador do cabeçalho são lidos a cada página, e contar mensagens ali
 *   pesaria em todo canal grande.
 */
return Migration::createTable(
    'canela_chat_channels',
    function (Blueprint $table) {
        $table->increments('id');
        $table->string('type', 20);
        $table->unsignedInteger('tag_id')->nullable();
        $table->string('name', 100)->nullable();
        $table->string('slug', 100)->nullable();
        $table->text('description')->nullable();
        $table->string('emoji', 64)->nullable();
        $table->unsignedTinyInteger('status')->default(0);
        $table->boolean('threading_enabled')->default(false);
        $table->boolean('allow_channel_wide_mentions')->default(true);
        $table->boolean('auto_join')->default(false);
        $table->boolean('is_group')->default(false);
        $table->string('direct_key', 191)->nullable();
        $table->unsignedInteger('last_message_id')->nullable();
        $table->unsignedInteger('messages_count')->default(0);
        $table->unsignedInteger('user_count')->default(0);
        $table->unsignedInteger('created_by_id')->nullable();
        $table->timestamps();

        $table->index(['type', 'status']);
        $table->index('tag_id');
        $table->index('slug');
        $table->unique('direct_key');

        $table->foreign('created_by_id')->references('id')->on('users')->nullOnDelete();
    }
);
