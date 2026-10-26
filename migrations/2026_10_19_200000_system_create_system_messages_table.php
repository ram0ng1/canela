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
use Ramon\Canela\System\Messages\MessageSender;

/*
 * As mensagens automáticas enviadas: as de boas-vindas e de nível saem uma
 * vez só por pessoa, e é esta tabela que lembra. A marca
 * `canela.system_messages_schema` diz ao código que ela existe.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * precisa ser idempotente e também grava uma configuração.
 */
return [
    'up' => static function (Builder $schema): void {
        if (! $schema->hasTable(MessageSender::TABLE)) {
            $schema->create(MessageSender::TABLE, static function (Blueprint $table): void {
                $table->increments('id');
                $table->unsignedInteger('user_id');
                $table->string('type', 64);
                $table->unsignedInteger('dialog_message_id')->nullable();
                $table->dateTime('created_at');

                $table->index(['user_id', 'type']);
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }

        $schema->getConnection()->table('settings')->updateOrInsert(['key' => MessageSender::SCHEMA], ['value' => '1']);
    },

    'down' => static function (Builder $schema): void {
        $schema->getConnection()->table('settings')->where('key', MessageSender::SCHEMA)->delete();
        $schema->dropIfExists(MessageSender::TABLE);
    },
];
