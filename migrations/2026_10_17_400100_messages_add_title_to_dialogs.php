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
 * O título da mensagem: no Discourse toda mensagem pessoal é um tópico, com
 * título, e o composer pede um. O flarum/messages não tem — o nome da conversa
 * é "Conversando com X" —, então o tema guarda o título na própria conversa.
 * Vazio, continua valendo o nome do flarum/messages.
 */
return [
    'up' => static function (Builder $schema): void {
        if (! $schema->hasTable('dialogs') || $schema->hasColumn('dialogs', 'canela_title')) {
            return;
        }

        $schema->table('dialogs', static function (Blueprint $table): void {
            $table->string('canela_title', 255)->nullable();
        });
    },

    'down' => static function (Builder $schema): void {
        if (! $schema->hasTable('dialogs') || ! $schema->hasColumn('dialogs', 'canela_title')) {
            return;
        }

        $schema->table('dialogs', static function (Blueprint $table): void {
            $table->dropColumn('canela_title');
        });
    },
];
