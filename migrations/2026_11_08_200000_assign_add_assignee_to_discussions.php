<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

/*
 * Atribuir tópico (Ramon\Canela\Assign): quem cuida do tópico. Apagar a
 * conta do responsável deixa o tópico sem atribuição.
 */
return [
    'up' => static function (Builder $schema): void {
        $schema->table('discussions', static function (Blueprint $table): void {
            $table->unsignedInteger('canela_assignee_id')->nullable();
            $table->foreign('canela_assignee_id')->references('id')->on('users')->nullOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->table('discussions', static function (Blueprint $table): void {
            $table->dropForeign(['canela_assignee_id']);
            $table->dropColumn('canela_assignee_id');
        });
    },
];
