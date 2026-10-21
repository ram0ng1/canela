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
use Flarum\Group\Group;
use Flarum\Messages\Dialog;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * A equipe como caixa de mensagens de grupo: quem escreve a um moderador ou
 * administrador fala com a equipe
 * toda, e a conversa aparece na caixa do grupo de todos os membros dela.
 *
 * O grupo da caixa é o dos Moderadores; sem moderadores, o dos
 * Administradores. Os administradores sempre entram junto (eles também veem
 * as mensagens da equipe).
 */
final class StaffGroups
{
    /** @var int[] */
    public const IDS = [Group::ADMINISTRATOR_ID, Group::MODERATOR_ID];

    public function __construct(
        private readonly ConnectionInterface $db,
    ) {
    }

    public static function isStaff(User $user): bool
    {
        return $user->groups->pluck('id')->map(fn ($id) => (int) $id)->intersect(self::IDS)->isNotEmpty();
    }

    /**
     * Quem está em cada grupo da equipe, numa consulta só: o atributo
     * `canelaMessageGroup` do fórum (toda página logada) pede o grupo da
     * caixa e os membros, e eram duas consultas. Vale para esta instância
     * (o atributo resolve uma por documento).
     *
     * @var array<int, int[]>|null grupo => usuários
     */
    private ?array $members = null;

    /** @return array<int, int[]> */
    private function members(): array
    {
        if ($this->members === null) {
            $this->members = [];

            foreach ($this->db->table('group_user')->whereIn('group_id', self::IDS)->get(['group_id', 'user_id']) as $row) {
                $this->members[(int) $row->group_id][] = (int) $row->user_id;
            }
        }

        return $this->members;
    }

    /** O grupo da caixa da equipe. */
    public function inboxGroupId(): int
    {
        return isset($this->members()[Group::MODERATOR_ID]) ? Group::MODERATOR_ID : Group::ADMINISTRATOR_ID;
    }

    /** @return int[] Os membros da equipe (moderadores e administradores). */
    public function memberIds(): array
    {
        $ids = [];

        foreach ($this->members() as $users) {
            array_push($ids, ...$users);
        }

        // Em ordem de id: o "contato" da equipe é sempre o mesmo.
        $ids = array_values(array_unique($ids));
        sort($ids);

        return $ids;
    }

    /** Alguém da equipe para receber, quando a mensagem é ao grupo (e não a uma pessoa). */
    public function contactFor(User $actor): ?int
    {
        $ids = array_values(array_diff($this->memberIds(), [(int) $actor->id]));

        return $ids[0] ?? null;
    }

    /**
     * Torna a conversa da caixa do grupo: tipo próprio (o flarum/messages só
     * reaproveita conversas `direct`, então mensagens novas à equipe abrem
     * conversas novas, como tópicos), o grupo marcado e cada
     * membro da equipe como participante "pelo grupo".
     *
     * @param int[] $personal quem continua com a conversa na caixa pessoal (quem escreveu)
     */
    public function convert(Dialog $dialog, int $groupId, array $personal): void
    {
        $this->db->table(MessagesSchema::DIALOG_TABLE)->where('id', $dialog->id)->update([
            'type' => MessagesSchema::GROUP_TYPE,
            MessagesSchema::GROUP_COLUMN => $groupId,
        ]);

        $members = $this->db->table(MessagesSchema::STATE_TABLE)->where('dialog_id', $dialog->id)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
        $staff = array_values(array_diff($this->memberIds(), $personal));

        // Quem já estava (o destinatário da equipe) passa a estar pelo grupo.
        $this->db->table(MessagesSchema::STATE_TABLE)
            ->where('dialog_id', $dialog->id)
            ->whereIn('user_id', $staff)
            ->update([MessagesSchema::VIA_GROUP_COLUMN => true]);

        $now = Carbon::now();
        $rows = array_map(static fn (int $userId): array => [
            'dialog_id' => $dialog->id,
            'user_id' => $userId,
            'joined_at' => $now,
            'last_read_message_id' => 0,
            MessagesSchema::VIA_GROUP_COLUMN => true,
        ], array_values(array_diff($staff, $members)));

        if ($rows) {
            $this->db->table(MessagesSchema::STATE_TABLE)->insert($rows);
        }
    }
}
