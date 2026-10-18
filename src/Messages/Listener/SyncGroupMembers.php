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

namespace Ramon\Canela\Messages\Listener;

use Carbon\Carbon;
use Flarum\User\Event\GroupsChanged;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Database\Query\Builder;
use Ramon\Canela\Messages\MessagesSchema;
use Ramon\Canela\Messages\StaffGroups;

/**
 * A caixa da equipe acompanha a equipe: quem entra para a moderação passa a
 * ver as mensagens da equipe (já lidas até ali, para não chegar com dezenas de
 * não lidas), e quem sai deixa de ver as que via só pelo grupo.
 */
final class SyncGroupMembers
{
    public function __construct(
        private readonly ConnectionInterface $db,
    ) {
    }

    public function handle(GroupsChanged $event): void
    {
        if (! MessagesSchema::hasGroups($this->db)) {
            return;
        }

        $user = $event->user;
        $wasStaff = collect($event->oldGroups)->pluck('id')->map(fn ($id) => (int) $id)->intersect(StaffGroups::IDS)->isNotEmpty();
        $isStaff = $user->groups()->pluck('groups.id')->map(fn ($id) => (int) $id)->intersect(StaffGroups::IDS)->isNotEmpty();

        if ($isStaff && ! $wasStaff) {
            $state = MessagesSchema::STATE_TABLE;
            $dialogs = $this->db->table(MessagesSchema::DIALOG_TABLE)
                ->whereNotNull(MessagesSchema::GROUP_COLUMN)
                ->whereNotExists(static function (Builder $q) use ($state, $user): void {
                    $q->selectRaw('1')->from($state)
                        ->whereColumn($state.'.dialog_id', MessagesSchema::DIALOG_TABLE.'.id')
                        ->where($state.'.user_id', $user->id);
                })
                ->get(['id', 'last_message_id']);

            $now = Carbon::now();
            $rows = $dialogs->map(static fn ($dialog): array => [
                'dialog_id' => $dialog->id,
                'user_id' => $user->id,
                'joined_at' => $now,
                'last_read_message_id' => (int) ($dialog->last_message_id ?? 0),
                MessagesSchema::VIA_GROUP_COLUMN => true,
            ])->all();

            if ($rows) {
                $this->db->table($state)->insert($rows);
            }
        }

        if ($wasStaff && ! $isStaff) {
            $this->db->table(MessagesSchema::STATE_TABLE)
                ->where('user_id', $user->id)
                ->where(MessagesSchema::VIA_GROUP_COLUMN, true)
                ->delete();
        }
    }
}
