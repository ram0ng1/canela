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
 * Índices para consultas do tema que rodam em páginas comuns e varriam a
 * tabela inteira (as chaves primárias começam pela outra coluna):
 *
 * - `post_likes(user_id)`: as curtidas dadas por alguém (o perfil e o cartão
 *   de usuário, os critérios dos níveis de confiança, a pré-carga do perfil);
 * - `group_user(group_id)`: os membros da equipe (toda página logada, para a
 *   caixa de mensagens da equipe) e a contagem de membros dos grupos.
 *
 * `post_likes` é do flarum/likes, que pode não estar instalado.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * só cria índices, e só os que ainda não existem.
 */
$indexes = [
    'post_likes' => ['user_id', 'canela_post_likes_user_id_index'],
    'group_user' => ['group_id', 'canela_group_user_group_id_index'],
];

return [
    'up' => static function (Builder $schema) use ($indexes): void {
        foreach ($indexes as $table => [$column, $name]) {
            if ($schema->hasTable($table) && ! $schema->hasIndex($table, $name)) {
                $schema->table($table, static function (Blueprint $blueprint) use ($column, $name): void {
                    $blueprint->index($column, $name);
                });
            }
        }
    },

    'down' => static function (Builder $schema) use ($indexes): void {
        foreach ($indexes as $table => [, $name]) {
            if ($schema->hasTable($table) && $schema->hasIndex($table, $name)) {
                $schema->table($table, static function (Blueprint $blueprint) use ($name): void {
                    $blueprint->dropIndex($name);
                });
            }
        }
    },
];
