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
 * O que o admin de emblemas precisa:
 *
 * - `image_url`: imagem no lugar do ícone, por endereço;
 * - `allow_title`: o emblema pode virar o título da pessoa (`allow_title`);
 * - `manual_grant`: a administração pode concedê-lo à mão. Os do sistema
 *   nascem sem isso — quem os concede é a regra automática, como lá;
 * - nas concessões, `reason` (o motivo ou link da concessão manual) e
 *   `granted_by_id` (quem concedeu; nulo nas automáticas).
 *
 * O código funciona sem estas colunas: os campos novos só aparecem depois
 * desta migração.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * também atualiza dados dos emblemas do sistema.
 */
return [
    'up' => static function (Builder $schema): void {
        $schema->table('canela_badges', static function (Blueprint $table): void {
            $table->string('image_url', 500)->nullable();
            $table->boolean('allow_title')->default(false);
            $table->boolean('manual_grant')->default(true);
        });

        $schema->getConnection()->table('canela_badges')->where('system', true)->update(['manual_grant' => false]);

        $schema->table('canela_user_badges', static function (Blueprint $table): void {
            $table->string('reason', 500)->nullable();
            $table->unsignedInteger('granted_by_id')->nullable();

            $table->foreign('granted_by_id')->references('id')->on('users')->nullOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->table('canela_user_badges', static function (Blueprint $table): void {
            $table->dropForeign(['granted_by_id']);
            $table->dropColumn(['reason', 'granted_by_id']);
        });

        $schema->table('canela_badges', static function (Blueprint $table): void {
            $table->dropColumn(['image_url', 'allow_title', 'manual_grant']);
        });
    },
];
