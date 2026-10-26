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
use Flarum\Messages\UserDialogState;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Ramon\Canela\Messages\DialogEvents;
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

                // Tirar outra pessoa (o ✕ na pílula dela): só a equipe ou quem
                // começou a conversa (`can_remove_allowed_users`).
                if ($userId !== (int) $actor->id) {
                    $starter = (int) ($dialog->firstMessage->user_id ?? 0);

                    if (! StaffGroups::isStaff($actor) && $starter !== (int) $actor->id) {
                        throw new PermissionDeniedException();
                    }
                }

                $removed = UserDialogState::query()
                    ->where('dialog_id', $dialog->id)
                    ->where('user_id', $userId)
                    ->delete();

                // "Removeu @fulano" ou "@fulano se removeu desta mensagem".
                if ($removed) {
                    $self = $userId === (int) $actor->id;
                    resolve(DialogEvents::class)->record((int) $dialog->id, (int) $actor->id, $self ? DialogEvents::USER_LEFT : DialogEvents::REMOVED_USER, $userId);
                }
            })
            ->response(fn () => new EmptyResponse(204));
    }
}
