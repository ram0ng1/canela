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
 * Marca as tabelas da IA como criadas (`canela.ai_schema`). Os campos da API
 * e os controladores só consultam as tabelas com a marca: o tema atualizado
 * antes do `migrate` não derruba a lista de tópicos. A marca é uma
 * configuração, que o Flarum já carrega — nenhuma consulta a mais.
 */
return [
    'up' => static function (Builder $schema): void {
        $schema->getConnection()->table('settings')->updateOrInsert(['key' => 'canela.ai_schema'], ['value' => '1']);
    },

    'down' => static function (Builder $schema): void {
        $schema->getConnection()->table('settings')->where('key', 'canela.ai_schema')->delete();
    },
];
