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
use Ramon\Canela\Messages\MessagesSchema;

/*
 * O título da mensagem: o composer pede um. O flarum/messages não tem — o nome da conversa
 * é "Conversando com X" —, então o tema guarda o título na própria conversa.
 * Vazio, continua valendo o nome do flarum/messages.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * só age se as tabelas do flarum/messages existirem. A criação mora no
 * MessagesSchema, idempotente: o tema ligado antes do flarum/messages tem o
 * esquema instalado depois, quando ele é habilitado (MessagesSchemaProvider).
 */
return [
    'up' => static function (Builder $schema): void {
        MessagesSchema::installTitle($schema);
    },

    'down' => static function (Builder $schema): void {
        // Sem esta parte, a marca de "esquema instalado" deixa de valer.
        MessagesSchema::forget($schema->getConnection());

        if (! $schema->hasTable('dialogs') || ! $schema->hasColumn('dialogs', 'canela_title')) {
            return;
        }

        $schema->table('dialogs', static function (Blueprint $table): void {
            $table->dropColumn('canela_title');
        });
    },
];
