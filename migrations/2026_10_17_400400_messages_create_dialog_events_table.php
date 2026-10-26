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
 * Os posts de ação pequena das mensagens ("Convidou @fulano", "Removeu
 * @fulano"): o flarum/messages só guarda mensagens, então os acontecimentos
 * da conversa ficam numa tabela do tema, apagados junto com a conversa.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * só age se as tabelas do flarum/messages existirem. A criação mora no
 * MessagesSchema, idempotente: o tema ligado antes do flarum/messages tem o
 * esquema instalado depois, quando ele é habilitado (MessagesSchemaProvider).
 */
return [
    'up' => static function (Builder $schema): void {
        MessagesSchema::installEvents($schema);
    },

    'down' => static function (Builder $schema): void {
        // Sem esta parte, a marca de "esquema instalado" deixa de valer.
        MessagesSchema::forget($schema->getConnection());

        $schema->dropIfExists('canela_dialog_events');
    },
];
