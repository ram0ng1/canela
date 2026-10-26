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

use Flarum\Messages\DialogMessage\Event\Created;
use Flarum\Messages\Job\SendMessageNotificationsJob;
use Flarum\User\User;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Messages\MessagesSchema;
use Ramon\Canela\Messages\StaffGroups;

/**
 * "Mensagem a um membro da equipe leva à equipe": a primeira mensagem de uma
 * conversa nova, de alguém de fora da equipe para alguém da equipe, vira
 * mensagem da caixa do grupo — todos os moderadores e administradores entram
 * nela e são notificados.
 *
 * O aviso do flarum/messages já saiu quando este ouvinte roda (ele foi
 * registrado antes), só para quem estava na conversa; o mesmo trabalho roda
 * de novo depois que a equipe entrou e avisa todos que não leram (o
 * NotificationSyncer não repete o aviso de quem já o tem).
 */
final class ConvertToGroupConversation
{
    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly StaffGroups $staff,
        private readonly Queue $queue,
    ) {
    }

    public function handle(Created $event): void
    {
        $message = $event->message;
        $dialog = $message->dialog;

        if (! $dialog || ! MessagesSchema::hasGroups($this->db) || (int) $message->number !== 1 || $dialog->type !== 'direct') {
            return;
        }

        $sender = $message->user;

        if (! $sender instanceof User || StaffGroups::isStaff($sender)) {
            return;
        }

        /** @var \Illuminate\Database\Eloquent\Collection<int, User> $others */
        $others = $dialog->users()->where('users.id', '!=', $sender->id)->with('groups')->get();

        if (! $others->contains(fn (User $user) => StaffGroups::isStaff($user))) {
            return;
        }

        $this->staff->convert($dialog, $this->staff->inboxGroupId(), [(int) $sender->id]);

        $this->queue->push(new SendMessageNotificationsJob($message));
    }
}
