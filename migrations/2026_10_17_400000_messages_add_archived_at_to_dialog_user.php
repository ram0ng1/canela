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
 * O arquivo de mensagens é por pessoa:
 * cada um arquiva a conversa na própria caixa. A linha de participação do
 * flarum/messages (`dialog_user`) já é "a conversa vista por esta pessoa",
 * então o arquivo é uma data nela — sem tabela nova, sem junção a mais.
 *
 * O flarum/messages é opcional: sem a tabela dele não há o que alterar.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * só age se as tabelas do flarum/messages existirem. A criação mora no
 * MessagesSchema, idempotente: o tema ligado antes do flarum/messages tem o
 * esquema instalado depois, quando ele é habilitado (MessagesSchemaProvider).
 */
return [
    'up' => static function (Builder $schema): void {
        MessagesSchema::installArchive($schema);
    },

    'down' => static function (Builder $schema): void {
        // Sem esta parte, a marca de "esquema instalado" deixa de valer.
        MessagesSchema::forget($schema->getConnection());

        if (! $schema->hasTable('dialog_user') || ! $schema->hasColumn('dialog_user', 'canela_archived_at')) {
            return;
        }

        $schema->table('dialog_user', static function (Blueprint $table): void {
            $table->dropIndex('dialog_user_canela_archived_index');
            $table->dropColumn('canela_archived_at');
        });
    },
];
