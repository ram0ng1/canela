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

use Flarum\Messages\DialogMessage;
use Flarum\Messages\DialogMessage\Event\Created;
use Flarum\Messages\DialogMessage\Event\Creating;
use Flarum\Messages\Job\SendMessageNotificationsJob;
use Flarum\User\User;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Ramon\Canela\Messages\MessagesSchema;
use Ramon\Canela\Messages\StaffGroups;

/**
 * "Mensagem à equipe": a primeira mensagem de uma conversa nova, de alguém de
 * fora da equipe, escrita à equipe (o grupo escolhido no seletor de
 * destinatários), vira mensagem da caixa do grupo — todos os moderadores e
 * administradores entram nela e são notificados.
 *
 * Só com a intenção explícita: o composer manda `canelaToGroup: true` nos
 * atributos quando o destinatário é o grupo (o contato da equipe vai em
 * `users` só porque o flarum/messages pede alguém). Uma mensagem a um
 * moderador, escolhido como pessoa, continua sendo a ele — conversa a dois.
 * A intenção é lida no `Creating` (o único que tem os dados do envio) e
 * guardada com a mensagem até o `Created`.
 *
 * O aviso do flarum/messages já saiu quando este ouvinte roda (ele foi
 * registrado antes), só para quem estava na conversa; o mesmo trabalho roda
 * de novo depois que a equipe entrou e avisa todos que não leram (o
 * NotificationSyncer não repete o aviso de quem já o tem).
 */
final class ConvertToGroupConversation
{
    /** O atributo do envio que pede a conversa com a equipe. */
    public const ATTRIBUTE = 'canelaToGroup';

    /** @var \WeakMap<DialogMessage, true>|null as mensagens enviadas à equipe */
    private static ?\WeakMap $intents = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly StaffGroups $staff,
        private readonly Queue $queue,
    ) {
    }

    /** Anota a intenção de escrever à equipe (só numa conversa nova). */
    public function creating(Creating $event): void
    {
        if ($event->message->dialog_id || Arr::get($event->data, 'relationships.dialog.data.id')) {
            return;
        }

        if (filter_var(Arr::get($event->data, 'attributes.'.self::ATTRIBUTE), FILTER_VALIDATE_BOOLEAN)) {
            self::$intents ??= new \WeakMap();
            self::$intents[$event->message] = true;
        }
    }

    public function handle(Created $event): void
    {
        $message = $event->message;

        if (! isset(self::$intents[$message])) {
            return;
        }

        unset(self::$intents[$message]);

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
