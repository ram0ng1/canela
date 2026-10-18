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
use Ramon\Canela\Chat\Model\Channel;

/**
 * `GET /api/chat/state`: os canais em que o ator está (os públicos que ele
 * segue e as MDs abertas), com as contagens de não lidas e menções.
 *
 * É o que alimenta a barra lateral, a lista da gaveta e o número do ícone do
 * cabeçalho. Sem websocket, o fórum repete esta chamada de tempos em tempos.
 */
final class StateController extends AbstractChatController
{
    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array|ResponseInterface|null
    {
        $this->service->autoJoin($actor);

        $query = Channel::query()
            ->whereExists(static function ($exists) use ($actor) {
                $exists->selectRaw('1')
                    ->from('canela_chat_memberships')
                    ->whereColumn('canela_chat_memberships.channel_id', 'canela_chat_channels.id')
                    ->where('canela_chat_memberships.user_id', $actor->id)
                    ->where('canela_chat_memberships.following', true);
            })
            ->orderBy('canela_chat_channels.name');

        $this->access->scopeVisibleChannels($query, $actor);

        return [
            'channels' => $this->presenter->channels($query->limit(500)->get(), $actor),
            'users' => $this->presenter->users(),
        ];
    }
}
