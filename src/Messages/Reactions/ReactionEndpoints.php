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

namespace Ramon\Canela\Messages\Reactions;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Foundation\ValidationException;
use Flarum\Messages\DialogMessage;
use Flarum\Notification\Notification;
use Flarum\Notification\NotificationSyncer;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;

/**
 * Os endpoints das reações nas mensagens privadas. O `{id}` passa pela
 * visibilidade do recurso de mensagens: só quem está na conversa reage e vê
 * quem reagiu.
 *
 * - `POST /api/dialog-messages/{id}/canela-react` com `reaction` (ou `null`
 *   para desfazer): devolve as contagens e a minha reação.
 * - `GET /api/dialog-messages/{id}/canela-reactions`: quem reagiu, por reação.
 */
final class ReactionEndpoints
{
    /** @return Endpoint\Endpoint[] */
    public static function endpoints(): array
    {
        return [
            Endpoint\Endpoint::make('canela.react')
                ->route('POST', '/{id}/canela-react')
                ->authenticated()
                ->action(function (Context $context): array {
                    /** @var DialogMessage $message */
                    $message = $context->model;
                    $actor = $context->getActor();
                    /** @var MessageReactions $reactions */
                    $reactions = resolve(MessageReactions::class);

                    if (! $reactions->enabled()) {
                        throw new ValidationException(['reaction' => 'reactions unavailable']);
                    }

                    $key = Arr::get($context->body(), 'reaction');
                    $key = $key === null || $key === '' ? null : (string) $key;

                    if ($key !== null && ! $reactions->isValid($key)) {
                        throw new ValidationException(['reaction' => 'invalid reaction']);
                    }

                    $fresh = $reactions->react((int) $message->id, $actor, $key);
                    $author = $message->user;

                    // O autor é avisado (não de reação à própria mensagem); desfazer tira o aviso.
                    if ($author && $author->id !== $actor->id) {
                        $syncer = resolve(NotificationSyncer::class);

                        if ($fresh) {
                            $syncer->sync(new MessageReactedBlueprint($message, $actor, (string) $key), [$author]);
                        } elseif ($key === null) {
                            // Pelo tipo, assunto e autor: o `delete` do syncer
                            // compara também os dados (a reação desfeita).
                            Notification::query()
                                ->where('type', MessageReactedBlueprint::getType())
                                ->where('subject_id', $message->id)
                                ->where('from_user_id', $actor->id)
                                ->update(['is_deleted' => true]);
                        }
                    }

                    return $reactions->summary((int) $message->id, $actor);
                })
                ->response(fn (Context $context, array $result) => new JsonResponse($result)),

            Endpoint\Endpoint::make('canela.reactions')
                ->route('GET', '/{id}/canela-reactions')
                ->authenticated()
                ->action(function (Context $context): array {
                    /** @var DialogMessage $message */
                    $message = $context->model;

                    return ['groups' => resolve(MessageReactions::class)->reactors((int) $message->id)];
                })
                ->response(fn (Context $context, array $result) => new JsonResponse($result)),
        ];
    }
}
