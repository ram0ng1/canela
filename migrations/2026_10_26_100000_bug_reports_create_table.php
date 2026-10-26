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
 * Os relatórios do "Relatar problema": o texto, o contexto da página (JSON) e
 * o caminho das capturas no disco privado. Quem reportou pode sair do fórum
 * sem levar o relatório junto (user_id vira nulo).
 */
return Migration::createTable(
    'canela_bug_reports',
    static function (Blueprint $table): void {
        $table->increments('id');
        $table->unsignedInteger('user_id')->nullable();
        $table->string('kind', 16)->default('bug');
        $table->string('status', 20)->default('open');
        $table->text('description');
        $table->text('current_text')->nullable();
        $table->text('suggested_text')->nullable();
        $table->string('url', 1000)->default('');
        $table->string('title', 200)->default('');
        $table->mediumText('context')->nullable();
        $table->string('region_path', 100)->nullable();
        $table->string('full_path', 100)->nullable();
        $table->text('admin_note')->nullable();
        $table->timestamps();

        $table->index(['status', 'id']);
        $table->index('user_id');

        $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
    }
);
