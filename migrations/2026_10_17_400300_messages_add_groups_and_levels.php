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
 * Mensagens de grupo e níveis de notificação:
 *
 * - `dialogs.canela_group_id`: a mensagem é da caixa de um grupo (a equipe:
 *   quem escreve a um moderador ou administrador fala com a equipe toda).
 * - `dialog_user.canela_via_group`: a pessoa está na conversa por ser do
 *   grupo — ela aparece na caixa do grupo, e não na pessoal.
 * - `dialog_user.canela_notification_level`: Observando (3), Acompanhando (2),
 *   Normal (1) ou Silenciado (0); vazio é o padrão para quem
 *   participa de uma mensagem (Observando).
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * só age se as tabelas do flarum/messages existirem. A criação mora no
 * MessagesSchema, idempotente: o tema ligado antes do flarum/messages tem o
 * esquema instalado depois, quando ele é habilitado (MessagesSchemaProvider).
 */
return [
    'up' => static function (Builder $schema): void {
        MessagesSchema::installGroups($schema);
    },

    'down' => static function (Builder $schema): void {
        // Sem esta parte, a marca de "esquema instalado" deixa de valer.
        MessagesSchema::forget($schema->getConnection());

        if ($schema->hasTable('dialogs') && $schema->hasColumn('dialogs', 'canela_group_id')) {
            $schema->table('dialogs', static function (Blueprint $table): void {
                $table->dropColumn('canela_group_id');
            });
        }

        if ($schema->hasTable('dialog_user') && $schema->hasColumn('dialog_user', 'canela_via_group')) {
            $schema->table('dialog_user', static function (Blueprint $table): void {
                $table->dropColumn(['canela_via_group', 'canela_notification_level']);
            });
        }
    },
];
