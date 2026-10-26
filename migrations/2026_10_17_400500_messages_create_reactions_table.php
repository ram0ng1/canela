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
 * Reações nas mensagens privadas: uma por pessoa por
 * mensagem. `reaction` é o id da reação do fof/reactions, quando ele está
 * ligado, ou o nome do emoji da lista padrão.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * só age se a tabela do flarum/messages existir.
 */
return [
    'up' => static function (Builder $schema): void {
        if (! $schema->hasTable('dialog_messages') || $schema->hasTable('canela_dialog_message_reactions')) {
            return;
        }

        $schema->create('canela_dialog_message_reactions', static function (Blueprint $table): void {
            $table->increments('id');
            $table->unsignedInteger('message_id');
            $table->unsignedInteger('user_id');
            $table->string('reaction', 64);
            $table->dateTime('created_at');

            $table->unique(['message_id', 'user_id'], 'canela_dmr_message_user_unique');
            $table->foreign('message_id')->references('id')->on('dialog_messages')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('canela_dialog_message_reactions');
    },
];
