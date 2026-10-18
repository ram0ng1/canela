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
 * Mensagens de grupo e níveis de notificação, como no Discourse:
 *
 * - `dialogs.canela_group_id`: a mensagem é da caixa de um grupo (a equipe:
 *   quem escreve a um moderador ou administrador fala com a equipe toda).
 * - `dialog_user.canela_via_group`: a pessoa está na conversa por ser do
 *   grupo — ela aparece na caixa do grupo, e não na pessoal.
 * - `dialog_user.canela_notification_level`: Observando (3), Acompanhando (2),
 *   Normal (1) ou Silenciado (0); vazio é o padrão do Discourse para quem
 *   participa de uma mensagem (Observando).
 */
return [
    'up' => static function (Builder $schema): void {
        if ($schema->hasTable('dialogs') && ! $schema->hasColumn('dialogs', 'canela_group_id')) {
            $schema->table('dialogs', static function (Blueprint $table): void {
                $table->unsignedInteger('canela_group_id')->nullable()->index();
            });
        }

        if ($schema->hasTable('dialog_user') && ! $schema->hasColumn('dialog_user', 'canela_via_group')) {
            $schema->table('dialog_user', static function (Blueprint $table): void {
                $table->boolean('canela_via_group')->default(false);
                $table->unsignedTinyInteger('canela_notification_level')->nullable();
            });
        }
    },

    'down' => static function (Builder $schema): void {
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
