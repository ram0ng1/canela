<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Builder;

/*
 * O detector local passou a exigir palavras comuns bastantes para o tamanho
 * do texto: antes, uma postagem com títulos em português e itens em inglês
 * saía "inglês" por quatro palavras e nunca era traduzida para quem lê em
 * inglês. Os idiomas que ele guardou são esquecidos e detectados de novo (os
 * da IA ficam); as traduções já feitas não mudam.
 */
return [
    'up' => static function (Builder $schema): void {
        if ($schema->hasTable('canela_ai_post_locales')) {
            $schema->getConnection()->table('canela_ai_post_locales')->where('source', 'heuristic')->delete();
        }
    },

    'down' => static function (Builder $schema): void {
        // Nada a desfazer: o detector grava de novo o que precisar.
    },
];
