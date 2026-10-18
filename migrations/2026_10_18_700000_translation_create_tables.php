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
 * As tabelas da tradução automática (o `ai_translation` do Discourse):
 *
 * - `canela_ai_post_locales`: o idioma detectado de cada postagem;
 * - `canela_ai_post_translations`: a postagem traduzida, já em HTML, por idioma;
 * - `canela_ai_title_translations`: o título do tópico traduzido, por idioma;
 * - `canela_ai_translation_usage`: as chamadas ao modelo por dia, no fórum todo.
 *
 * O `source_hash` é o sha1 do conteúdo que foi detectado/traduzido: se a
 * postagem mudar por um caminho que não dispara o evento de edição, o registro
 * velho deixa de valer sozinho. Tudo some junto com a postagem ou o tópico.
 *
 * Uma migração só, com a marca no fim: os campos da API só aparecem quando as
 * quatro tabelas existem.
 */
return [
    'up' => static function (Builder $schema): void {
        if (! $schema->hasTable('canela_ai_post_locales')) {
            $schema->create('canela_ai_post_locales', static function (Blueprint $table): void {
                $table->unsignedInteger('post_id')->primary();
                $table->string('locale', 16);
                // heuristic | ai — o que a IA detecta não é refeito pela heurística.
                $table->string('source', 10);
                $table->char('source_hash', 40);
                $table->dateTime('updated_at');

                $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
            });
        }

        if (! $schema->hasTable('canela_ai_post_translations')) {
            $schema->create('canela_ai_post_translations', static function (Blueprint $table): void {
                $table->unsignedInteger('post_id');
                $table->string('locale', 16);
                $table->string('source_locale', 16);
                $table->mediumText('content_html');
                $table->char('source_hash', 40);
                $table->string('model', 100)->nullable();
                $table->dateTime('created_at');

                $table->primary(['post_id', 'locale']);
                $table->foreign('post_id')->references('id')->on('posts')->cascadeOnDelete();
            });
        }

        if (! $schema->hasTable('canela_ai_title_translations')) {
            $schema->create('canela_ai_title_translations', static function (Blueprint $table): void {
                $table->unsignedInteger('discussion_id');
                $table->string('locale', 16);
                $table->string('source_locale', 16);
                $table->string('title', 255);
                $table->char('source_hash', 40);
                $table->dateTime('created_at');

                $table->primary(['discussion_id', 'locale']);
                $table->foreign('discussion_id')->references('id')->on('discussions')->cascadeOnDelete();
            });
        }

        if (! $schema->hasTable('canela_ai_translation_usage')) {
            $schema->create('canela_ai_translation_usage', static function (Blueprint $table): void {
                $table->date('day')->primary();
                $table->unsignedInteger('requests')->default(0);
                $table->unsignedInteger('input_tokens')->default(0);
                $table->unsignedInteger('output_tokens')->default(0);
            });
        }

        $schema->getConnection()->table('settings')->updateOrInsert(['key' => 'canela.ai_translation_schema'], ['value' => '1']);
    },

    'down' => static function (Builder $schema): void {
        $schema->getConnection()->table('settings')->where('key', 'canela.ai_translation_schema')->delete();
        $schema->dropIfExists('canela_ai_translation_usage');
        $schema->dropIfExists('canela_ai_title_translations');
        $schema->dropIfExists('canela_ai_post_translations');
        $schema->dropIfExists('canela_ai_post_locales');
    },
];
