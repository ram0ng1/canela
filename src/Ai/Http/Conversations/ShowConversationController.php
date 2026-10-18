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

namespace Ramon\Canela\Ai\Http\Conversations;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Conversation;
use Ramon\Canela\Ai\Http\AiGate;
use Ramon\Canela\Ai\Message;

/**
 * `GET /api/canela/ai/conversations/{id}`: uma conversa com as mensagens.
 *
 * Só a dona vê: a conversa de outra pessoa responde 404, e não 403 — nem a
 * existência dela é da conta de quem pergunta.
 */
final class ShowConversationController implements RequestHandlerInterface
{
    public function __construct(
        private readonly AiGate $gate,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->gate->feature(AiSettings::BOT);

        $actor = RequestUtil::getActor($request);
        $this->gate->user($actor);

        $conversation = Conversation::query()->where('user_id', $actor->id)->find(AiGate::routeId($request));

        if (! $conversation instanceof Conversation) {
            throw new RouteNotFoundException();
        }

        $messages = $conversation->messages()->orderBy('id')->get();

        return new JsonResponse([
            'data' => [
                'conversation' => $conversation->toSummaryArray(),
                'messages' => $messages->map(static fn (Message $message): array => $message->toApiArray())->values()->all(),
            ],
        ]);
    }
}
