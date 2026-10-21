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
use Flarum\Foundation\ValidationException;
use Flarum\Locale\Translator;
use Flarum\Messages\Access\MessagingPermission;
use Flarum\Messages\Dialog;
use Flarum\Messages\DialogMessage\Event\Creating;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Ramon\Canela\Messages\Api\DialogActions;
use Ramon\Canela\Messages\MessagesSchema;

/**
 * Mensagem nova para várias pessoas: a API do
 * flarum/messages aceita um destinatário só (`users`), e o tema manda os
 * outros em `canelaUsers`.
 *
 * Com mais de um destinatário a conversa é sempre NOVA (a do par não é
 * reaproveitada): ela nasce aqui, com todo mundo, e a mensagem é ligada a ela
 * antes que o flarum/messages procure a conversa do par. As regras são as do
 * flarum/messages para cada destinatário (visível, pode receber, conseguiria
 * responder) e o limite de destinatários.
 */
final class CreateGroupConversation
{
    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Translator $translator,
    ) {
    }

    public function handle(Creating $event): void
    {
        $message = $event->message;
        $data = $event->data;

        if ($message->dialog_id || Arr::get($data, 'relationships.dialog.data.id')) {
            return;
        }

        $extra = array_map('intval', (array) Arr::get($data, 'attributes.canelaUsers', []));
        $first = array_map('intval', Arr::pluck((array) Arr::get($data, 'attributes.users', []), 'id'));
        $actor = $message->user ?? User::find($message->user_id);

        if (! $extra || ! $actor) {
            return;
        }

        $ids = array_values(array_unique(array_filter(
            array_merge($first, $extra),
            fn (int $id) => $id && $id !== (int) $actor->id
        )));

        if (count($ids) < 2) {
            return;
        }

        if (count($ids) + 1 > DialogActions::MAX_RECIPIENTS) {
            throw new ValidationException(['users' => $this->translator->trans('ramon-canela.api.messages.recipients_limit', ['max' => DialogActions::MAX_RECIPIENTS])]);
        }

        $actor->assertCan('sendAnyMessage');

        $users = User::whereVisibleTo($actor)->whereIn('id', $ids)->get();

        if ($users->count() !== count($ids)) {
            throw new ValidationException(['users' => str_replace(':attribute', 'users', $this->translator->trans('validation.exists'))]);
        }

        $canMessageAnyone = MessagingPermission::canMessageUsersWithoutPermission($actor);

        foreach ($users as $recipient) {
            if ($actor->cannot('message', $recipient)) {
                throw new ValidationException(['users' => $this->translator->trans('flarum-messages.lib.recipient_unavailable_message', ['username' => $recipient->display_name])]);
            }

            if (! $canMessageAnyone && ! MessagingPermission::canReply($recipient)) {
                throw new ValidationException(['users' => $this->translator->trans('flarum-messages.lib.recipient_cannot_reply_message', ['username' => $recipient->display_name])]);
            }
        }

        $dialog = $this->db->transaction(function () use ($users, $actor, $canMessageAnyone): Dialog {
            $dialog = new Dialog();
            $dialog->type = MessagesSchema::GROUP_TYPE;
            $dialog->anyone_can_reply = $canMessageAnyone;
            $dialog->save();

            $now = Carbon::now();
            $members = $users->pluck('id')->push($actor->id)->unique()->all();
            $dialog->users()->attach(array_fill_keys($members, ['joined_at' => $now]));

            return $dialog;
        });

        $message->dialog()->associate($dialog);
    }
}
