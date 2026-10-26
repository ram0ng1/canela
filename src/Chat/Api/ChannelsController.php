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
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Support\NullOrder;

/**
 * `/api/chat/channels`
 *
 * - GET: "Navegar por todos os canais" — os canais públicos que o ator
 *   enxerga, com os filtros de status (`status`: all, open, closed,
 *   archived) e a busca por nome (`q`).
 * - POST: cria um canal público (administradores e os grupos do admin).
 */
final class ChannelsController extends AbstractChatController
{
    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array
    {
        if ($method === 'POST') {
            $channel = $this->service->createChannel($actor, $this->body($request));

            return $this->presentChannel($channel, $actor);
        }

        $query = Channel::query()->where('canela_chat_channels.type', Channel::TYPE_PUBLIC);
        $this->access->scopeVisibleChannels($query, $actor);

        $status = $this->query($request, 'status') ?? 'all';
        $statusCode = array_search($status, Channel::STATUS_NAMES, true);

        if ($statusCode !== false) {
            $query->where('canela_chat_channels.status', $statusCode);
        } elseif (! $this->access->canModerate($actor)) {
            // "Tudo" para quem não modera ainda deixa de fora os arquivados,
            // que só interessam à moderação.
            $query->where('canela_chat_channels.status', '<>', Channel::STATUS_ARCHIVED);
        }

        $term = trim((string) $this->query($request, 'q'));

        if ($term !== '') {
            $like = '%'.addcslashes($term, '\\%_').'%';
            $query->where(static fn (Builder $q) => $q->whereLike('canela_chat_channels.name', $like, caseSensitive: false)->orWhereLike('canela_chat_channels.description', $like, caseSensitive: false));
        }

        $offset = max(0, (int) ($this->query($request, 'offset') ?? 0));
        NullOrder::orderBy($query, 'canela_chat_channels.name');
        $rows = $query->offset($offset)->limit(51)->get();

        return [
            'channels' => $this->presenter->channels($rows->take(50), $actor),
            'users' => $this->presenter->users(),
            'hasMore' => $rows->count() > 50,
        ];
    }
}
