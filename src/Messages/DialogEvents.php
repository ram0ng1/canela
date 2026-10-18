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

namespace Ramon\Canela\Messages;

use Carbon\Carbon;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Support\SchemaCache;

/**
 * Os "posts de ação pequena" de uma mensagem do Discourse (`action_codes`):
 * "Convidou @fulano", "Convidou o grupo", "Removeu @fulano". O flarum/messages
 * só guarda mensagens; o tema guarda esses acontecimentos à parte
 * (`canela_dialog_events`) e o fórum os mostra no fluxo, entre as mensagens,
 * pela hora.
 *
 * Sem a tabela (migration ainda não rodada) nada é registrado.
 */
final class DialogEvents
{
    public const TABLE = 'canela_dialog_events';

    public const INVITED_USER = 'invited_user';

    public const INVITED_GROUP = 'invited_group';

    public const REMOVED_USER = 'removed_user';

    public const USER_LEFT = 'user_left';

    /** Quantos acontecimentos vão com a conversa (os mais recentes). */
    private const LIMIT = 100;

    private static ?bool $exists = null;

    public function __construct(
        private readonly ConnectionInterface $db,
    ) {
    }

    public function enabled(): bool
    {
        return self::$exists ??= resolve(SchemaCache::class)->hasTable(self::TABLE);
    }

    public function record(int $dialogId, int $actorId, string $type, ?int $targetUserId = null, ?int $targetGroupId = null): void
    {
        if (! $this->enabled()) {
            return;
        }

        $this->db->table(self::TABLE)->insert([
            'dialog_id' => $dialogId,
            'user_id' => $actorId,
            'type' => $type,
            'target_user_id' => $targetUserId,
            'target_group_id' => $targetGroupId,
            'created_at' => Carbon::now(),
        ]);
    }

    /**
     * Os acontecimentos da conversa, com os nomes já resolvidos (quem fez e
     * quem foi convidado/removido), para o fórum desenhar sem pedir mais nada.
     *
     * @return array<int, array<string, mixed>>
     */
    public function forDialog(int $dialogId): array
    {
        if (! $this->enabled()) {
            return [];
        }

        $rows = $this->db->table(self::TABLE.' as canela_ev')
            ->leftJoin('users as canela_ev_actor', 'canela_ev_actor.id', '=', 'canela_ev.user_id')
            ->leftJoin('users as canela_ev_target', 'canela_ev_target.id', '=', 'canela_ev.target_user_id')
            ->leftJoin('groups as canela_ev_group', 'canela_ev_group.id', '=', 'canela_ev.target_group_id')
            ->where('canela_ev.dialog_id', $dialogId)
            ->orderByDesc('canela_ev.id')
            ->limit(self::LIMIT)
            ->get([
                'canela_ev.id', 'canela_ev.type', 'canela_ev.created_at', 'canela_ev.user_id', 'canela_ev.target_user_id', 'canela_ev.target_group_id',
                'canela_ev_actor.username as actor_username', 'canela_ev_target.username as target_username', 'canela_ev_group.name_plural as group_name',
            ]);

        return $rows->reverse()->values()->map(static fn ($row): array => [
            'id' => (int) $row->id,
            'type' => (string) $row->type,
            'createdAt' => Carbon::parse($row->created_at)->toIso8601String(),
            'actorId' => $row->user_id !== null ? (string) $row->user_id : null,
            'actorUsername' => $row->actor_username,
            'targetUserId' => $row->target_user_id !== null ? (string) $row->target_user_id : null,
            'targetUsername' => $row->target_username,
            'groupName' => $row->group_name,
        ])->all();
    }
}
