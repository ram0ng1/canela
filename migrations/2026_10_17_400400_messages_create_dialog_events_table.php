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
 * Os posts de ação pequena das mensagens ("Convidou @fulano", "Removeu
 * @fulano"): o flarum/messages só guarda mensagens, então os acontecimentos
 * da conversa ficam numa tabela do tema, apagados junto com a conversa.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * só age se a tabela do flarum/messages existir.
 */
return [
    'up' => static function (Builder $schema): void {
        if (! $schema->hasTable('dialogs') || $schema->hasTable('canela_dialog_events')) {
            return;
        }

        $schema->create('canela_dialog_events', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('dialog_id');
            $table->unsignedInteger('user_id')->nullable();
            $table->string('type', 32);
            $table->unsignedInteger('target_user_id')->nullable();
            $table->unsignedInteger('target_group_id')->nullable();
            $table->dateTime('created_at');

            $table->index('dialog_id');
            $table->foreign('dialog_id')->references('id')->on('dialogs')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('target_user_id')->references('id')->on('users')->nullOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('canela_dialog_events');
    },
];
