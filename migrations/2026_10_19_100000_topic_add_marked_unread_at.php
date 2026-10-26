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
use Ramon\Canela\Topic\MarkUnread;

/*
 * "Marcar não lido" depois de "marcar tudo como lido": o core conta como lido
 * tudo que não teve post novo depois daquela data, seja qual for o estado de
 * leitura. A data em que a pessoa marcou aquele tópico como não lido, mais
 * nova que a de "marcar tudo", faz ele voltar a contar.
 *
 * A marca `canela.marked_unread_schema` diz ao código que a coluna existe.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * precisa ser idempotente e também grava uma configuração.
 */
return [
    'up' => static function (Builder $schema): void {
        if (! $schema->hasColumn('discussion_user', MarkUnread::COLUMN)) {
            $schema->table('discussion_user', static function (Blueprint $table): void {
                $table->dateTime(MarkUnread::COLUMN)->nullable();
            });
        }

        $schema->getConnection()->table('settings')->updateOrInsert(['key' => MarkUnread::SCHEMA], ['value' => '1']);
    },

    'down' => static function (Builder $schema): void {
        $schema->getConnection()->table('settings')->where('key', MarkUnread::SCHEMA)->delete();

        if ($schema->hasColumn('discussion_user', MarkUnread::COLUMN)) {
            $schema->table('discussion_user', static function (Blueprint $table): void {
                $table->dropColumn(MarkUnread::COLUMN);
            });
        }
    },
];
