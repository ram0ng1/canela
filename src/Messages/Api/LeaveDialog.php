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

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Messages\Dialog;
use Flarum\Messages\Notification\MessageReceivedBlueprint;
use Flarum\Messages\UserDialogState;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Ramon\Canela\Messages\DialogEvents;
use Ramon\Canela\Messages\MessagesSchema;
use Ramon\Canela\Messages\Reactions\MessageReactedBlueprint;
use Ramon\Canela\Messages\StaffGroups;

/**
 * `DELETE /api/dialogs/{id}/canela-membership`: o "✕" ao lado do próprio nome
 * no mapa de participantes ("Tem certeza de que quer sair desta
 * mensagem?").
 *
 * Sair é tirar a própria linha da `dialog_user`: a conversa deixa de ser
 * visível para quem saiu e continua para os outros. O flarum/messages já
 * trata o resto — quem ficou não consegue mais responder ("não há mais
 * ninguém nesta conversa"), e uma mensagem nova entre os dois abre outra
 * conversa, porque ela procura uma em que os dois estão.
 *
 * Tirar outra pessoa, como no fof/byobu (`editUserRecipients`, da equipe):
 *
 * - a equipe tira qualquer um;
 * - quem começou a conversa tira só quem não é da equipe, e só numa conversa
 *   que não é da caixa da equipe (`canela_group_id`). Na conversa com a
 *   equipe, quem escreveu é uma pessoa comum: não tira moderadores dela.
 *
 * Sair (ou tirar) o último participante apaga a conversa, como o
 * flarum/messages faz quando a última mensagem é apagada: ninguém mais a
 * veria, e ela ficaria órfã no banco. As mensagens, os acontecimentos e as
 * reações vão junto (chaves estrangeiras em cascata).
 */
final class LeaveDialog
{
    public static function endpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.leave')
            ->route('DELETE', '/{id}/canela-membership')
            ->authenticated()
            ->action(function (Context $context): void {
                /** @var Dialog $dialog */
                $dialog = $context->model;
                $actor = $context->getActor();
                $userId = (int) (Arr::get($context->request->getQueryParams(), 'userId') ?: $actor->id);
                $self = $userId === (int) $actor->id;

                if (! $self && ! self::canRemove($actor, $dialog, $userId)) {
                    throw new PermissionDeniedException();
                }

                /** @var ConnectionInterface $db */
                $db = resolve(ConnectionInterface::class);

                $deleted = $db->transaction(static function () use ($db, $dialog, $userId): ?bool {
                    $removed = UserDialogState::query()
                        ->where('dialog_id', $dialog->id)
                        ->where('user_id', $userId)
                        ->delete();

                    if (! $removed) {
                        return null;
                    }

                    if ($db->table(MessagesSchema::STATE_TABLE)->where('dialog_id', $dialog->id)->exists()) {
                        return false;
                    }

                    self::deleteDialog($db, $dialog);

                    return true;
                });

                // "Removeu @fulano" ou "@fulano se removeu desta mensagem" —
                // na conversa que continua.
                if ($deleted === false) {
                    resolve(DialogEvents::class)->record((int) $dialog->id, (int) $actor->id, $self ? DialogEvents::USER_LEFT : DialogEvents::REMOVED_USER, $userId);
                }
            })
            ->response(fn () => new EmptyResponse(204));
    }

    /** Quem pode tirar `$userId` da conversa (outra pessoa, não quem pede). */
    public static function canRemove(User $actor, Dialog $dialog, int $userId): bool
    {
        if (StaffGroups::isStaff($actor)) {
            return true;
        }

        if ((int) ($dialog->firstMessage->user_id ?? 0) !== (int) $actor->id) {
            return false;
        }

        if ($dialog->getAttribute(MessagesSchema::GROUP_COLUMN)) {
            return false;
        }

        $target = User::query()->with('groups')->find($userId);

        return ! $target instanceof User || ! StaffGroups::isStaff($target);
    }

    /**
     * Apaga a conversa sem ninguém, com o que é dela. As chaves estrangeiras
     * em cascata já fariam quase tudo, mas nem todo banco as tem ligadas (o
     * SQLite sem `foreign_keys`), e os avisos das mensagens não têm chave
     * nenhuma: tudo sai às claras, antes da conversa.
     */
    private static function deleteDialog(ConnectionInterface $db, Dialog $dialog): void
    {
        $messages = $db->table('dialog_messages')->where('dialog_id', $dialog->id)->pluck('id')->all();

        if ($messages) {
            $db->table('notifications')
                ->whereIn('type', [MessageReceivedBlueprint::getType(), MessageReactedBlueprint::getType()])
                ->whereIn('subject_id', $messages)
                ->delete();

            if (MessagesSchema::hasReactions()) {
                $db->table(MessagesSchema::REACTIONS_TABLE)->whereIn('message_id', $messages)->delete();
            }
        }

        if (MessagesSchema::hasEvents()) {
            $db->table(MessagesSchema::EVENTS_TABLE)->where('dialog_id', $dialog->id)->delete();
        }

        $db->table(MessagesSchema::DIALOG_TABLE)->where('id', $dialog->id)->update(['first_message_id' => null, 'last_message_id' => null]);
        $db->table('dialog_messages')->where('dialog_id', $dialog->id)->delete();
        $db->table(MessagesSchema::DIALOG_TABLE)->where('id', $dialog->id)->delete();
    }
}
