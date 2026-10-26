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

namespace Ramon\Canela\Messages\Api;

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Foundation\ValidationException;
use Flarum\Messages\Dialog;
use Flarum\Messages\DialogMessage;
use Flarum\Messages\Job\SendMessageNotificationsJob;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Contracts\Queue\Queue;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Ramon\Canela\Messages\DialogEvents;
use Ramon\Canela\Messages\MessagesSchema;
use Ramon\Canela\Messages\StaffGroups;
use Ramon\Canela\System\SystemDialogs;

/**
 * Os botões do tópico de mensagem que o flarum/messages não tem:
 *
 * - `POST /api/dialogs/{id}/canela-invite` ("+" no mapa → "Convidar"):
 *   acrescenta pessoas (ou a equipe) à conversa e as avisa.
 * - `POST /api/dialogs/{id}/canela-unread` ("● Marcar não lido"): volta a
 *   leitura para antes da última mensagem.
 */
final class DialogActions
{
    /** O limite de destinatários de uma mensagem. */
    public const MAX_RECIPIENTS = 30;

    public static function inviteEndpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.invite')
            ->route('POST', '/{id}/canela-invite')
            ->authenticated()
            ->action(function (Context $context): void {
                /** @var Dialog $dialog */
                $dialog = $context->model;
                $actor = $context->getActor();
                /** @var ConnectionInterface $db */
                $db = resolve(ConnectionInterface::class);
                /** @var DialogEvents $events */
                $events = resolve(DialogEvents::class);

                // Quem participa (e pode escrever) ou a equipe (`ensure_can_invite_to!`).
                if (! $actor->can('sendMessage', $dialog) && ! StaffGroups::isStaff($actor)) {
                    throw new PermissionDeniedException();
                }

                // A conversa do usuário do sistema não recebe ninguém: lá não
                // se responde, e um convite a abriria como uma conversa comum.
                if (SystemDialogs::involvesSystem($dialog, $actor)) {
                    throw new PermissionDeniedException();
                }

                $body = $context->body();
                $ids = array_values(array_unique(array_map('intval', (array) Arr::get($body, 'userIds', []))));
                $groupId = (int) Arr::get($body, 'groupId', 0);

                /** @var \Flarum\Locale\TranslatorInterface $translator */
                $translator = resolve(\Flarum\Locale\TranslatorInterface::class);

                if (! $ids && ! $groupId) {
                    throw new ValidationException(['userIds' => $translator->trans('ramon-canela.api.messages.invite_empty')]);
                }

                // A equipe: a conversa vira da caixa do grupo.
                if ($groupId) {
                    if (! in_array($groupId, StaffGroups::IDS, true) || ! MessagesSchema::hasGroups($db)) {
                        throw new ValidationException(['groupId' => $translator->trans('ramon-canela.api.messages.invite_group_invalid')]);
                    }

                    // Convidar de novo o mesmo grupo só repetiria o post "Convidou o grupo".
                    $current = (int) $db->table(MessagesSchema::DIALOG_TABLE)->where('id', $dialog->id)->value(MessagesSchema::GROUP_COLUMN);

                    if ($current === $groupId) {
                        $name = (string) (\Flarum\Group\Group::find($groupId)?->name_plural ?? '');

                        throw new ValidationException(['groupId' => $translator->trans('ramon-canela.api.messages.invite_group_already', ['group' => $name])]);
                    }

                    resolve(StaffGroups::class)->convert($dialog, $groupId, [(int) $actor->id]);
                    $events->record((int) $dialog->id, (int) $actor->id, DialogEvents::INVITED_GROUP, null, $groupId);
                }

                $members = $db->table(MessagesSchema::STATE_TABLE)->where('dialog_id', $dialog->id)->pluck('user_id')->map(fn ($id) => (int) $id)->all();
                $users = User::whereVisibleTo($actor)->whereIn('id', array_diff($ids, $members))->get()
                    ->filter(fn (User $user) => $actor->can('message', $user));

                // "pm_reached_recipients_limit": a equipe que entra pelo grupo não conta.
                if (count($members) + $users->count() > self::MAX_RECIPIENTS && ! $groupId) {
                    throw new ValidationException(['userIds' => $translator->trans('ramon-canela.api.messages.recipients_limit', ['max' => self::MAX_RECIPIENTS])]);
                }

                // Quem chega vê a última mensagem como não lida (e é avisado
                // dela): a leitura começa logo antes dela.
                $before = (int) DialogMessage::query()->where('dialog_id', $dialog->id)->where('id', '<', (int) $dialog->last_message_id)->max('id');
                $now = Carbon::now();

                // Um por um e sem erro na repetição: dois convites iguais ao
                // mesmo tempo (clique duplo, duas abas) batiam no índice único
                // (dialog_id, user_id) e davam 500. Só quem entrou de fato
                // ganha o aviso "convidou fulano" na conversa.
                foreach ($users as $user) {
                    $inserted = $db->table(MessagesSchema::STATE_TABLE)->insertOrIgnore([
                        'dialog_id' => $dialog->id,
                        'user_id' => $user->id,
                        'joined_at' => $now,
                        'last_read_message_id' => $before,
                    ]);

                    if ($inserted > 0) {
                        $events->record((int) $dialog->id, (int) $actor->id, DialogEvents::INVITED_USER, (int) $user->id);
                    }
                }

                // Mais de duas pessoas: o flarum/messages não reaproveita mais
                // a conversa para "mensagem nova" entre duas delas.
                $db->table(MessagesSchema::DIALOG_TABLE)->where('id', $dialog->id)->update(['type' => MessagesSchema::GROUP_TYPE]);

                $last = $dialog->last_message_id ? DialogMessage::find($dialog->last_message_id) : null;

                if ($last) {
                    resolve(Queue::class)->push(new SendMessageNotificationsJob($last));
                }
            })
            ->response(fn () => new EmptyResponse(204));
    }

    public static function unreadEndpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.unread')
            ->route('POST', '/{id}/canela-unread')
            ->authenticated()
            ->action(function (Context $context): void {
                /** @var Dialog $dialog */
                $dialog = $context->model;
                /** @var ConnectionInterface $db */
                $db = resolve(ConnectionInterface::class);

                $before = (int) DialogMessage::query()->where('dialog_id', $dialog->id)->where('id', '<', (int) $dialog->last_message_id)->max('id');

                $db->table(MessagesSchema::STATE_TABLE)
                    ->where('dialog_id', $dialog->id)
                    ->where('user_id', $context->getActor()->id)
                    ->update(['last_read_message_id' => $before]);
            })
            ->response(fn () => new EmptyResponse(204));
    }
}
