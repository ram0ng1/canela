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

namespace Ramon\Canela\Chat\Api;

use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatPresenter;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\MessageQuery;

/**
 * `/api/chat/channels/{id}/messages`
 *
 * - GET: as mensagens por cursor (`before`, `after`, `around`, `limit`) do canal
 *   ou de um fio (`thread`), com os autores e o necessário para desenhá-las.
 * - POST: envia (`message`, `inReplyToId`, `threadId`, `uploadIds`).
 */
final class MessagesController extends AbstractChatController
{
    public function __construct(
        ChatAccess $access,
        ChatService $service,
        ChatPresenter $presenter,
        private readonly MessageQuery $messages,
    ) {
        parent::__construct($access, $service, $presenter);
    }

    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array
    {
        $channel = $this->channel($request, $actor);

        if ($method === 'POST') {
            $body = $this->body($request);

            $message = $this->service->createMessage(
                $channel,
                $actor,
                (string) ($body['message'] ?? ''),
                isset($body['inReplyToId']) ? (int) $body['inReplyToId'] : null,
                isset($body['threadId']) ? (int) $body['threadId'] : null,
                array_map('intval', (array) ($body['uploadIds'] ?? [])),
            );

            return $this->presentMessage($message, $channel, $actor);
        }

        $threadId = (int) ($this->query($request, 'thread') ?? 0);
        $thread = $threadId ? $this->thread($threadId, $actor)[0] : null;

        $result = $this->messages->fetch($channel, $actor, $thread, $request->getQueryParams());

        return [
            'messages' => $this->presenter->messages($result['messages'], $channel, $actor),
            'users' => $this->presenter->users(),
            'meta' => [
                'canLoadMorePast' => $result['canLoadMorePast'],
                'canLoadMoreFuture' => $result['canLoadMoreFuture'],
                'targetMessageId' => $result['targetMessageId'],
            ],
        ];
    }
}
