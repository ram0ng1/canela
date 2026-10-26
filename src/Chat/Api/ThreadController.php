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
use Ramon\Canela\Chat\Model\ThreadMembership;
use Ramon\Canela\Chat\UnreadCounter;

/**
 * `/api/chat/threads/{id}`: GET o fio (título, original, participantes, o
 * acompanhamento do ator); PATCH título e nível de notificação; e
 * `POST …/read` marca lido.
 */
final class ThreadController extends AbstractChatController
{
    public function __construct(
        ChatAccess $access,
        ChatService $service,
        ChatPresenter $presenter,
        private readonly UnreadCounter $counter,
    ) {
        parent::__construct($access, $service, $presenter);
    }

    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array
    {
        [$thread, $channel] = $this->thread($this->routeInt($request, 'id'), $actor);
        $body = $this->body($request);

        if (($request->getQueryParams()['action'] ?? '') === 'read') {
            $this->service->markThreadRead($thread, $actor, isset($body['messageId']) ? (int) $body['messageId'] : null);
        } elseif ($method === 'PATCH') {
            $this->service->updateThread($thread, $channel, $actor, $body);
        }

        $thread->refresh();

        /** @var ThreadMembership|null $membership */
        $membership = ThreadMembership::query()->where('thread_id', $thread->id)->where('user_id', $actor->id)->first();
        $unread = $membership ? ($this->counter->threadUnread($actor, [$thread->id])[$thread->id] ?? 0) : 0;

        return [
            'thread' => $this->presenter->thread($thread, $channel, $actor, $membership, $unread),
            'users' => $this->presenter->users(),
        ];
    }
}
