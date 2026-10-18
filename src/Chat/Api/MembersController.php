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
use Illuminate\Database\Eloquent\Builder;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Chat\Model\Membership;

/**
 * `/api/chat/channels/{id}/members`: GET lista os membros (com o filtro
 * "Encontrar membros"); POST adiciona pessoas (`userIds`).
 */
final class MembersController extends AbstractChatController
{
    private const PAGE = 50;

    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array|ResponseInterface|null
    {
        $channel = $this->channel($request, $actor);

        if ($method === 'POST') {
            $this->service->addMembers($channel, $actor, (array) ($this->body($request)['userIds'] ?? []));
        }

        $query = Membership::query()
            ->where('canela_chat_memberships.channel_id', $channel->id)
            ->when(! $channel->isDirect(), static fn (Builder $q) => $q->where('canela_chat_memberships.following', true))
            ->join('users', 'users.id', '=', 'canela_chat_memberships.user_id')
            ->select('canela_chat_memberships.user_id')
            ->orderBy('users.username');

        $term = trim((string) $this->query($request, 'q'));

        if ($term !== '') {
            $like = addcslashes($term, '\\%_').'%';
            $query->where('users.username', 'like', $like);
        }

        $offset = max(0, (int) ($this->query($request, 'offset') ?? 0));
        $ids = $query->offset($offset)->limit(self::PAGE + 1)->pluck('user_id')->map(static fn ($id) => (int) $id);

        $users = User::query()->whereIn('id', $ids->take(self::PAGE)->all() ?: [0])->get()->sortBy(static fn (User $u) => $ids->search($u->id))->values();
        $this->presenter->addLoadedUsers($users);

        return [
            'memberIds' => $users->pluck('id')->all(),
            'users' => $this->presenter->users(),
            'hasMore' => $ids->count() > self::PAGE,
            'total' => $channel->isDirect() ? Membership::query()->where('channel_id', $channel->id)->count() : $channel->user_count,
        ];
    }
}
