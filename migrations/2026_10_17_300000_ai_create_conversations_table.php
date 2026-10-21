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
 * As conversas com o bot de IA: uma por pergunta nova, de um usuário só.
 *
 * - `persona` é a chave da persona escolhida (as personas moram numa
 *   configuração, não numa tabela): uma persona removida depois não apaga a
 *   conversa, que continua com a padrão.
 * - O índice (user_id, updated_at) é o da barra lateral, que lista as
 *   conversas de uma pessoa da mais recente para a mais antiga.
 */
return Migration::createTable(
    'canela_ai_conversations',
    function (Blueprint $table) {
        $table->increments('id');
        $table->unsignedInteger('user_id');
        $table->string('title', 255)->nullable();
        $table->string('persona', 50)->nullable();
        $table->unsignedInteger('message_count')->default(0);
        $table->timestamps();

        $table->index(['user_id', 'updated_at']);

        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
