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
 * `canela_ai_page_translations`: as páginas da área Sobre (Diretrizes,
 * Termos, Privacidade e as abas extras) traduzidas pela IA, por página e
 * idioma. `source` é a página (`guidelines` ou `page:{id}` do fof/pages);
 * `source_hash` é o sha1 do título e do HTML traduzidos, e a página editada
 * deixa de valer sozinha. `html` vazio guarda "nada a traduzir" (o modelo
 * devolveu o mesmo texto): a página não é pedida de novo.
 *
 * Escrita à mão, idempotente, como a das outras tabelas da tradução.
 */
return [
    'up' => static function (Builder $schema): void {
        if ($schema->hasTable('canela_ai_page_translations')) {
            return;
        }

        $schema->create('canela_ai_page_translations', static function (Blueprint $table): void {
            $table->string('source', 40);
            $table->string('locale', 16);
            $table->string('source_locale', 16);
            $table->string('title', 255);
            $table->mediumText('html');
            $table->char('source_hash', 40);
            $table->dateTime('created_at');

            $table->primary(['source', 'locale']);
        });
    },

    'down' => static function (Builder $schema): void {
        $schema->dropIfExists('canela_ai_page_translations');
    },
];
