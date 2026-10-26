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
 * As visualizações da mensagem (a coluna "Visualizações" da lista de
 * mensagens). Na própria
 * conversa, como o `canela_view_count` dos tópicos: a lista mostra o número
 * sem somar nada a cada página.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * só age se a tabela do flarum/messages existir.
 */
return [
    'up' => static function (Builder $schema): void {
        if (! $schema->hasTable('dialogs') || $schema->hasColumn('dialogs', 'canela_view_count')) {
            return;
        }

        $schema->table('dialogs', static function (Blueprint $table): void {
            $table->unsignedInteger('canela_view_count')->default(0);
        });
    },

    'down' => static function (Builder $schema): void {
        if (! $schema->hasTable('dialogs') || ! $schema->hasColumn('dialogs', 'canela_view_count')) {
            return;
        }

        $schema->table('dialogs', static function (Blueprint $table): void {
            $table->dropColumn('canela_view_count');
        });
    },
];
