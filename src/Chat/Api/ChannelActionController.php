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
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatPresenter;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Pin;
use Ramon\Canela\Chat\Model\Thread;
use Ramon\Canela\Chat\Model\ThreadMembership;
use Ramon\Canela\Chat\Realtime\ChatBroadcaster;
use Ramon\Canela\Chat\Realtime\TypingStore;
use Ramon\Canela\Chat\UnreadCounter;

/**
 * As ações sobre um canal, pelo último pedaço do caminho:
 *
 * - `POST …/read`: marca lido até `messageId` (ou até o fim).
 * - `POST …/typing`: "está digitando" (`typing`, `threadId`).
 * - `GET …/pins` e `POST …/pins/read`: as fixadas e o "já vi".
 * - `GET …/threads`: os fios do canal, do mais recente para o mais antigo.
 */
final class ChannelActionController extends AbstractChatController
{
    public function __construct(
        ChatAccess $access,
        ChatService $service,
        ChatPresenter $presenter,
        private readonly ChatBroadcaster $broadcaster,
        private readonly TypingStore $typing,
        private readonly UnreadCounter $counter,
        private readonly Cache $cache,
    ) {
        parent::__construct($access, $service, $presenter);
    }

    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array|ResponseInterface|null
    {
        $channel = $this->channel($request, $actor);
        $body = $this->body($request);

        switch ((string) ($request->getQueryParams()['action'] ?? '')) {
            case 'read':
                $this->service->markRead($channel, $actor, isset($body['messageId']) ? (int) $body['messageId'] : null);

                return $this->presentChannel($channel, $actor);

            case 'typing':
                $typing = (bool) ($body['typing'] ?? true);
                $threadId = isset($body['threadId']) ? (int) $body['threadId'] : null;

                // Só avisa quem pode escrever aqui (não suspensos, canal aberto),
                // e só num fio deste canal.
                if ($this->access->cannotPostReason($channel, $actor, $this->access->membership($channel, $actor)) !== null) {
                    return null;
                }

                if ($threadId !== null && ! Thread::query()->whereKey($threadId)->where('channel_id', $channel->id)->exists()) {
                    return null;
                }

                // Cada aviso vira um push para todo o canal: no máximo um por
                // estado a cada 2 s (o fórum já manda a cada 4 s, no mínimo).
                if (! $this->cache->add("canela.chat.typing.{$channel->id}.{$actor->id}.".(int) $typing, 1, 2)) {
                    return null;
                }

                $this->typing->set($channel->id, $threadId, (int) $actor->id, $typing);
                $this->broadcaster->toChannel($channel, [
                    'type' => 'typing',
                    'threadId' => $threadId,
                    'userId' => $actor->id,
                    'typing' => $typing,
                    // O nome vai junto: quem está digitando pode não estar no
                    // store de quem recebe, e o aviso não espera uma consulta.
                    'username' => $actor->display_name,
                ], (int) $actor->id);

                return null;

            case 'pins':
                $pins = Pin::query()->where('channel_id', $channel->id)->orderByDesc('created_at')->get();
                $messages = Message::query()->whereIn('id', $pins->pluck('message_id')->all() ?: [0])->whereNull('deleted_at')->get()
                    ->sortBy(static fn (Message $m) => $pins->search(static fn (Pin $p) => $p->message_id === $m->id))->values();

                return [
                    'messages' => $this->presenter->messages($messages, $channel, $actor),
                    'users' => $this->presenter->users(),
                ];

            case 'pins-read':
                $this->service->markPinsRead($channel, $actor);

                return null;

            case 'threads':
                if (! $this->access->threadsOn($channel)) {
                    throw new ModelNotFoundException();
                }

                $threads = Thread::query()
                    ->where('channel_id', $channel->id)
                    ->where('replies_count', '>', 0)
                    ->whereHas('originalMessage', static fn ($q) => $q->whereNull('deleted_at'))
                    ->orderByDesc('last_message_id')
                    ->limit(50)
                    ->get();

                $memberships = ThreadMembership::query()->where('user_id', $actor->id)->whereIn('thread_id', $threads->pluck('id')->all() ?: [0])->get()->keyBy('thread_id');
                $unread = $this->counter->threadUnread($actor, $memberships->keys()->all());

                return [
                    'threads' => $threads->map(fn (Thread $thread) => $this->presenter->thread($thread, $channel, $actor, $memberships->get($thread->id), $unread[$thread->id] ?? 0))->values()->all(),
                    'users' => $this->presenter->users(),
                ];
        }

        throw new ModelNotFoundException();
    }
}
