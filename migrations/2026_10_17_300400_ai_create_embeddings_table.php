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
 * Os embeddings (vetores) dos tópicos, para os "Tópicos relacionados".
 *
 * O vetor vai em base64 dos floats de 32 bits: a similaridade por cosseno é
 * feita em PHP, sobre poucos milhares de tópicos, e um banco de vetores seria
 * uma dependência a mais para um fórum desse tamanho. O `digest` (sha1 do
 * texto embutido) diz quando o tópico mudou e precisa de um vetor novo; o
 * `model`, quando o admin trocou de modelo e todos precisam.
 */
return Migration::createTable(
    'canela_ai_embeddings',
    function (Blueprint $table) {
        $table->unsignedInteger('discussion_id')->primary();
        $table->string('model', 100);
        $table->char('digest', 40);
        $table->mediumText('vector');
        $table->dateTime('updated_at');

        $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
    }
);
