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
 * Nível de confiança do Discourse (0 a 4) na própria tabela de usuários.
 *
 * - `canela_trust_level`: o nível atual. Coluna, e não calculado na hora,
 *   porque os emblemas de nível e a promoção dependem do valor anterior.
 * - `canela_trust_level_locked`: o admin fixou o nível; o sistema não
 *   promove nem rebaixa (o `manual_locked_trust_level` do Discourse).
 * - `canela_trust_level_at`: quando o nível mudou pela última vez. O Discourse
 *   não rebaixa um Regular nos primeiros 100 dias depois da promoção (período
 *   de carência), e isso só se sabe guardando a data.
 */
return [
    'up' => static function (Builder $schema): void {
        $schema->table('users', static function (Blueprint $table): void {
            $table->unsignedTinyInteger('canela_trust_level')->default(0);
            $table->boolean('canela_trust_level_locked')->default(false);
            $table->dateTime('canela_trust_level_at')->nullable();

            $table->index('canela_trust_level', 'users_canela_trust_level_index');
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->table('users', static function (Blueprint $table): void {
            $table->dropIndex('users_canela_trust_level_index');
            $table->dropColumn(['canela_trust_level', 'canela_trust_level_locked', 'canela_trust_level_at']);
        });
    },
];
