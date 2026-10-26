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

use Carbon\Carbon;
use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatPresenter;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\MessageQuery;
use Ramon\Canela\Chat\Realtime\TypingStore;

/**
 * `GET /api/chat/channels/{id}/updates?after=…&since=…[&thread=…]`: o polling
 * do modo sem websocket.
 *
 * Numa chamada só: as mensagens novas (depois de `after`), as que mudaram desde
 * `since` (editadas, apagadas, com reação ou fixadas — tudo isso mexe no
 * `updated_at`) e quem está digitando. `now` volta para ser o próximo `since`,
 * no relógio do servidor, que é o que vale para o `updated_at`.
 */
final class UpdatesController extends AbstractChatController
{
    public function __construct(
        ChatAccess $access,
        ChatService $service,
        ChatPresenter $presenter,
        private readonly MessageQuery $messages,
        private readonly TypingStore $typing,
    ) {
        parent::__construct($access, $service, $presenter);
    }

    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array
    {
        $channel = $this->channel($request, $actor);
        $threadId = (int) ($this->query($request, 'thread') ?? 0);
        $thread = $threadId ? $this->thread($threadId, $actor)[0] : null;
        $now = Carbon::now();

        $after = (int) ($this->query($request, 'after') ?? 0);
        $new = $this->messages->base($channel, $actor, $thread)->where('id', '>', $after)->orderBy('id')->limit(MessageQuery::MAX_LIMIT)->get();

        $changed = collect();
        $since = $this->query($request, 'since');

        if ($since !== null && $after > 0) {
            try {
                $sinceAt = Carbon::parse($since)->subSecond();

                // Até `after` inclusive: as mais novas já vieram em `new`. Na
                // moderação as apagadas vêm junto; para os outros, uma mensagem
                // que sumiu é a que não volta mais na consulta — o `removed`.
                $changed = $this->messages->base($channel, $actor, $thread)
                    ->where('id', '<=', $after)
                    ->where('updated_at', '>=', $sinceAt)
                    ->orderBy('id')
                    ->limit(MessageQuery::MAX_LIMIT)
                    ->get();

                $removed = \Ramon\Canela\Chat\Model\Message::query()
                    ->where('channel_id', $channel->id)
                    ->where('id', '<=', $after)
                    ->where('updated_at', '>=', $sinceAt)
                    ->whereNotNull('deleted_at')
                    ->whereNotIn('id', $changed->pluck('id')->all() ?: [0])
                    ->limit(MessageQuery::MAX_LIMIT)
                    ->pluck('id')
                    ->all();
            } catch (\Throwable) {
                $changed = collect();
            }
        }

        return [
            'messages' => $this->presenter->messages($new, $channel, $actor),
            'changed' => $this->presenter->messages($changed, $channel, $actor),
            'removedIds' => $removed ?? [],
            'typingUserIds' => $this->typingUsers($channel->id, $thread?->id, (int) $actor->id),
            'users' => $this->presenter->users(),
            'now' => $now->toAtomString(),
        ];
    }

    /** @return int[] */
    private function typingUsers(int $channelId, ?int $threadId, int $actorId): array
    {
        $ids = $this->typing->get($channelId, $threadId, $actorId);

        foreach ($ids as $id) {
            $this->presenter->addUser($id);
        }

        return $ids;
    }
}
