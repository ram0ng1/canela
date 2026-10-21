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
 * As mensagens de cada conversa com a IA: a pergunta de quem usa e a resposta
 * do bot, em Markdown (desenhado no navegador pelo mesmo formatador dos posts).
 *
 * - `tools` guarda o que o bot consultou (as buscas no fórum e os tópicos
 *   lidos), para a resposta mostrar "Pesquisou por…" com os links.
 * - Os tokens ficam por mensagem para o admin saber quanto cada conversa
 *   custou; o limite diário mora em canela_ai_usage.
 */
return Migration::createTable(
    'canela_ai_messages',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('conversation_id');
        $table->string('role', 20);
        $table->mediumText('content');
        $table->json('tools')->nullable();
        $table->string('model', 100)->nullable();
        $table->unsignedInteger('input_tokens')->default(0);
        $table->unsignedInteger('output_tokens')->default(0);
        $table->dateTime('created_at');

        $table->index(['conversation_id', 'id']);

        $table->foreign('conversation_id')->references('id')->on('canela_ai_conversations')->cascadeOnDelete();
    }
);
