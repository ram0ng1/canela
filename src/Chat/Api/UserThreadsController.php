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
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Thread;
use Ramon\Canela\Chat\Model\ThreadMembership;
use Ramon\Canela\Chat\UnreadCounter;

/**
 * `GET /api/chat/threads`: "Meus tópicos" do Discourse — os fios que o ator
 * acompanha, em todos os canais que ele ainda enxerga, do mais movimentado
 * recentemente para o mais antigo.
 */
final class UserThreadsController extends AbstractChatController
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
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array|ResponseInterface|null
    {
        $memberships = ThreadMembership::query()
            ->where('user_id', $actor->id)
            ->where('notification_level', '>', Thread::LEVEL_MUTED)
            ->get()
            ->keyBy('thread_id');

        $channels = Channel::query()->where('threading_enabled', true);
        $this->access->scopeVisibleChannels($channels, $actor);
        $channels = $channels->get()->keyBy('id');

        $threads = Thread::query()
            ->whereIn('id', $memberships->keys()->all() ?: [0])
            ->whereIn('channel_id', $channels->keys()->all() ?: [0])
            ->where('replies_count', '>', 0)
            ->orderByDesc('last_message_id')
            ->limit(50)
            ->get();

        $unread = $this->counter->threadUnread($actor, $threads->pluck('id')->all());

        return [
            'threads' => $threads->map(fn (Thread $thread) => $this->presenter->thread($thread, $channels->get($thread->channel_id), $actor, $memberships->get($thread->id), $unread[$thread->id] ?? 0))->values()->all(),
            'channels' => $this->presenter->channels($channels->only($threads->pluck('channel_id')->unique()->all())->values(), $actor, false),
            'users' => $this->presenter->users(),
        ];
    }
}
