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
 * Um clique por linha num link de postagem, como o `topic_link_clicks` do
 * Discourse: daqui saem o número ao lado do link no post, os "Links populares"
 * do mapa do tópico e os "Melhores links" do resumo do perfil.
 *
 * O endereço vai inteiro em `url` (para mostrar) e num sha1 em `url_hash`
 * (para agrupar e indexar: um índice num texto de até 2 000 caracteres não
 * caberia no limite de chave do MariaDB). `user_id` fica vazio para
 * visitantes; quem apagar a conta deixa os cliques, que são do link, não dela.
 */
return Migration::createTable(
    'canela_link_clicks',
    static function (Blueprint $table): void {
        $table->increments('id');
        $table->unsignedInteger('post_id');
        $table->unsignedInteger('discussion_id');
        $table->unsignedInteger('user_id')->nullable();
        $table->char('url_hash', 40);
        $table->string('url', 2000);
        $table->dateTime('created_at');

        $table->index(['discussion_id', 'url_hash']);
        $table->index(['post_id', 'url_hash']);
        $table->index('created_at');

        $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
        $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
        $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
    }
);
