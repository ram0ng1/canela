<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Ai\Access;

use Flarum\Group\Group;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Ai\AiSettings;

/**
 * Passa o acesso à IA das listas de grupos nas configurações
 * (`canela.ai_allowed_groups`, `canela.ai_summary_groups`) para permissões de
 * verdade na `group_permission` — a migração `ai_add_permissions` chama isto.
 *
 * Quem podia continua podendo, grupo por grupo:
 * - configuração nunca gravada = o padrão de antes, o grupo Membros (3);
 * - lista vazia = só administradores (que já têm toda permissão): nada a gravar;
 * - o grupo Visitantes (2) nunca entra. Antes ele não valia (visitante não
 *   usa a IA), e na `group_permission` ele daria a permissão a toda conta,
 *   até às de e-mail não confirmado;
 * - grupo que não existe mais fica de fora (a chave estrangeira recusaria).
 *
 * Fica numa classe, e não só no arquivo da migração, para o teste conferir a
 * passagem com configurações diferentes.
 */
final class SeedAiPermissions
{
    /** Permissão => a configuração de grupos de onde ela vem. */
    public const SOURCES = [
        AiSettings::USE_PERMISSION => AiSettings::ALLOWED_GROUPS,
        AiSettings::SUMMARIZE_PERMISSION => AiSettings::SUMMARY_GROUPS,
    ];

    public static function up(ConnectionInterface $db): void
    {
        foreach (self::SOURCES as $permission => $setting) {
            foreach (self::groupIds($db, $setting) as $groupId) {
                $row = ['group_id' => $groupId, 'permission' => $permission];

                if ($db->table('groups')->where('id', $groupId)->doesntExist() || $db->table('group_permission')->where($row)->exists()) {
                    continue;
                }

                $db->table('group_permission')->insert($row);
            }
        }
    }

    public static function down(ConnectionInterface $db): void
    {
        $db->table('group_permission')->whereIn('permission', array_keys(self::SOURCES))->delete();
    }

    /** @return list<int> */
    public static function groupIds(ConnectionInterface $db, string $setting): array
    {
        $value = $db->table('settings')->where('key', $setting)->value('value');
        $value = $value === null ? (string) Group::MEMBER_ID : (string) $value;

        $ids = array_map('intval', preg_split('/[\s,]+/', trim($value)) ?: []);

        return array_values(array_unique(array_filter($ids, static fn (int $id): bool => $id > 0 && $id !== Group::GUEST_ID)));
    }
}
