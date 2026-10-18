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
use Ramon\Canela\Chat\Model\Membership;

/**
 * `GET /api/chat/users?q=…[&channel=…]`: a busca de pessoas do chat — o
 * autocompletar do `@` e o seletor de "Nova mensagem".
 *
 * Não usa o /api/users do core: ele exige a permissão de procurar usuários, e
 * quem pode conversar precisa achar com quem conversar. Por isso só devolve o
 * mínimo (nome, avatar) e só por prefixo, com no máximo 10 resultados. Com
 * `channel`, marca quem é membro (o aviso "não participa do canal" do
 * Discourse) e põe os membros primeiro.
 */
final class UsersController extends AbstractChatController
{
    private const LIMIT = 10;

    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array|ResponseInterface|null
    {
        $term = trim((string) $this->query($request, 'q'));
        $term = ltrim($term, '@');

        $query = User::query()->where('is_email_confirmed', true)->limit(30);

        // Sem termo (o seletor acabou de abrir), quem esteve por aqui há pouco.
        if ($term !== '') {
            $query->where('username', 'like', addcslashes($term, '\\%_').'%')->orderBy('username');
        } else {
            $query->orderByDesc('last_seen_at');
        }

        $users = $query->get()->filter(fn (User $user) => $this->access->canUse($user))->values();

        $memberIds = [];
        $channelId = (int) ($this->query($request, 'channel') ?? 0);

        if ($channelId) {
            $channel = $this->access->findChannel($channelId, $actor);
            $memberIds = Membership::query()->where('channel_id', $channel->id)->where('following', true)->whereIn('user_id', $users->pluck('id')->all() ?: [0])->pluck('user_id')->map(static fn ($id) => (int) $id)->all();
            $users = $users->sortBy(static fn (User $u) => in_array($u->id, $memberIds, true) ? 0 : 1)->values();
        }

        $users = $users->take(self::LIMIT);
        $this->presenter->addLoadedUsers($users);

        return [
            'userIds' => $users->pluck('id')->all(),
            'memberIds' => $memberIds,
            'users' => $this->presenter->users(),
        ];
    }
}
