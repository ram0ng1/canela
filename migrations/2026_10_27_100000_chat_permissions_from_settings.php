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
 * Quem usa o chat, manda MD, cria canais e modera deixa de ser uma lista de
 * grupos nas configurações (`canela.chat_*_groups`, "3,4") e passa a ser
 * permissão do Flarum (`group_permission`), em Administração → Permissões.
 *
 * O `up` semeia cada permissão com os grupos que a configuração tinha — ou,
 * sem a configuração gravada, com o padrão de antes (`3`, `3`, vazio e `4`) —,
 * e só então apaga a configuração. Assim um fórum existente continua com
 * exatamente as mesmas pessoas podendo o mesmo:
 *
 * - lista vazia: nenhum grupo recebe a permissão, e só os administradores
 *   podem (o Flarum libera tudo para eles, como o `inGroups()` fazia);
 * - Visitantes (2) na lista valia para todo usuário logado, até sem e-mail
 *   confirmado (o grupo 2 está nos grupos de permissão de todo mundo); como
 *   permissão do grupo 2, vale o mesmo;
 * - um grupo que não existe mais fica de fora (a chave estrangeira recusaria).
 *
 * O `down` faz o caminho inverso: grava de volta as listas com os grupos que
 * têm cada permissão agora (sem o Administrador, que nunca precisou estar
 * nela) e tira as permissões.
 */

$map = [
    'canela.chat_allowed_groups' => ['canela.chat.use', '3'],
    'canela.chat_dm_groups' => ['canela.chat.directMessage', '3'],
    'canela.chat_create_channel_groups' => ['canela.chat.createChannel', ''],
    'canela.chat_moderator_groups' => ['canela.chat.moderate', '4'],
];

return [
    'up' => static function (Builder $schema) use ($map): void {
        $db = $schema->getConnection();

        foreach ($map as $key => [$permission, $default]) {
            $raw = $db->table('settings')->where('key', $key)->value('value');
            $raw = $raw === null ? $default : (string) $raw;

            $ids = array_values(array_unique(array_filter(
                array_map('intval', preg_split('/[\s,]+/', $raw) ?: []),
                static fn (int $id) => $id > 0
            )));

            foreach ($ids as $groupId) {
                $row = ['group_id' => $groupId, 'permission' => $permission];

                if ($db->table('groups')->where('id', $groupId)->doesntExist() || $db->table('group_permission')->where($row)->exists()) {
                    continue;
                }

                $db->table('group_permission')->insert($row);
            }

            $db->table('settings')->where('key', $key)->delete();
        }
    },

    'down' => static function (Builder $schema) use ($map): void {
        $db = $schema->getConnection();

        foreach ($map as $key => [$permission]) {
            $ids = $db->table('group_permission')
                ->where('permission', $permission)
                ->where('group_id', '<>', 1)
                ->orderBy('group_id')
                ->pluck('group_id')
                ->map(static fn ($id) => (int) $id)
                ->all();

            $db->table('settings')->updateOrInsert(['key' => $key], ['value' => implode(',', $ids)]);
            $db->table('group_permission')->where('permission', $permission)->delete();
        }
    },
];
