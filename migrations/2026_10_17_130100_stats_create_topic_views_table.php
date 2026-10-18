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
 * Quem viu cada tópico e quando — só para não contar a mesma pessoa duas vezes
 * dentro da janela configurada, e para o "Tópicos vistos" do perfil.
 *
 * Uma linha por (tópico, usuário) ou (tópico, visitante): a visualização nova
 * atualiza `viewed_at` em vez de inserir, o que mantém a tabela do tamanho de
 * "pares distintos", e não do número de acessos. Visitantes entram por um hash
 * de IP + navegador (nunca o IP puro), e as linhas deles são podadas depois da
 * janela, porque não servem para mais nada.
 *
 * Os dois índices únicos aceitam vários NULL: o de usuário vale para quem
 * entrou na conta, o do hash para visitantes.
 */
return Migration::createTable(
    'canela_topic_views',
    static function (Blueprint $table): void {
        $table->increments('id');
        $table->unsignedInteger('discussion_id');
        $table->unsignedInteger('user_id')->nullable();
        $table->string('ip_hash', 64)->nullable();
        $table->dateTime('viewed_at');

        $table->unique(['discussion_id', 'user_id']);
        $table->unique(['discussion_id', 'ip_hash']);
        $table->index('user_id');
        $table->index('viewed_at');

        $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
    }
);
