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
 * Os emblemas.
 *
 * O `slug` é a identidade de um emblema do sistema: é por ele que o código
 * sabe qual regra concede "Primeira curtida", e por ele que a tradução do nome
 * é encontrada. O nome e as descrições gravados aqui são só o texto de reserva
 * (pt-BR), para quando o idioma do visitante não tiver tradução.
 *
 * `type` guarda gold|silver|bronze por extenso, e não um número (1, 2, 3): é
 * o que a API e o CSS usam, e ninguém precisa decorar a ordem.
 */
return Migration::createTable(
    'canela_badges',
    static function (Blueprint $table): void {
        $table->increments('id');
        $table->string('slug', 100)->unique();
        $table->string('name', 100);
        $table->string('description', 500)->nullable();
        $table->text('long_description')->nullable();
        $table->string('icon', 100)->default('fas fa-certificate');
        $table->string('type', 10)->default('bronze');
        $table->string('grouping', 30)->default('other');
        $table->unsignedInteger('position')->default(0);
        $table->boolean('multiple_grant')->default(false);
        $table->boolean('enabled')->default(true);
        $table->boolean('listable')->default(true);
        $table->boolean('system')->default(false);
        $table->dateTime('created_at')->nullable();

        $table->index(['enabled', 'listable']);
    }
);
