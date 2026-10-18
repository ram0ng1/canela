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

namespace Ramon\Canela\Chat;

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Thread;

/**
 * As mensagens de um canal ou de um fio, por cursor — o ListChannelMessages do
 * Discourse.
 *
 * Paginar por id, e não por página: no chat chegam mensagens o tempo todo, e um
 * "offset" pularia ou repetiria mensagens a cada envio. A conversa abre em volta
 * da primeira não lida (`around`) ou no fim; rolar para cima pede as anteriores
 * (`before`) e para baixo as seguintes (`after`).
 */
final class MessageQuery
{
    public const DEFAULT_LIMIT = 50;

    public const MAX_LIMIT = 100;

    public function __construct(
        private readonly ChatAccess $access,
    ) {
    }

    /**
     * @return Builder<Message>
     */
    public function base(Channel $channel, User $actor, ?Thread $thread): Builder
    {
        $query = Message::query()->where('canela_chat_messages.channel_id', $channel->id);

        if ($thread) {
            $query->where('canela_chat_messages.thread_id', $thread->id);
        } elseif ($this->access->threadsOn($channel)) {
            // Na conversa principal, só as originais dos fios — as respostas
            // moram no painel do fio.
            $query->where(static function (Builder $q) use ($channel) {
                $q->whereNull('canela_chat_messages.thread_id')
                    ->orWhereIn('canela_chat_messages.id', Thread::query()->select('original_message_id')->where('channel_id', $channel->id));
            });
        }

        if (! $this->access->canModerateChannel($channel, $actor)) {
            $query->where(static function (Builder $q) use ($actor) {
                $q->whereNull('canela_chat_messages.deleted_at')->orWhere('canela_chat_messages.user_id', $actor->id);
            });
        }

        return $query;
    }

    /**
     * @param array<string, mixed> $params
     * @return array{messages: Collection<int, Message>, canLoadMorePast: bool, canLoadMoreFuture: bool, targetMessageId: int|null}
     */
    public function fetch(Channel $channel, User $actor, ?Thread $thread, array $params): array
    {
        $limit = max(1, min(self::MAX_LIMIT, (int) ($params['limit'] ?? self::DEFAULT_LIMIT)));
        $before = isset($params['before']) ? (int) $params['before'] : null;
        $after = isset($params['after']) ? (int) $params['after'] : null;
        $around = isset($params['around']) ? (int) $params['around'] : null;

        if ($before) {
            $rows = $this->rows($this->base($channel, $actor, $thread)->where('id', '<', $before), 'desc', $limit + 1);

            return [
                'messages' => $rows->take($limit)->reverse()->values(),
                'canLoadMorePast' => $rows->count() > $limit,
                'canLoadMoreFuture' => true,
                'targetMessageId' => null,
            ];
        }

        if ($after) {
            $rows = $this->rows($this->base($channel, $actor, $thread)->where('id', '>', $after), 'asc', $limit + 1);

            return [
                'messages' => $rows->take($limit)->values(),
                'canLoadMorePast' => true,
                'canLoadMoreFuture' => $rows->count() > $limit,
                'targetMessageId' => null,
            ];
        }

        if ($around) {
            $half = intdiv($limit, 2);
            $past = $this->rows($this->base($channel, $actor, $thread)->where('id', '<=', $around), 'desc', $half + 1);
            $future = $this->rows($this->base($channel, $actor, $thread)->where('id', '>', $around), 'asc', $half + 1);

            return [
                'messages' => $past->take($half)->reverse()->values()->concat($future->take($half))->values(),
                'canLoadMorePast' => $past->count() > $half,
                'canLoadMoreFuture' => $future->count() > $half,
                'targetMessageId' => $around,
            ];
        }

        $rows = $this->rows($this->base($channel, $actor, $thread), 'desc', $limit + 1);

        return [
            'messages' => $rows->take($limit)->reverse()->values(),
            'canLoadMorePast' => $rows->count() > $limit,
            'canLoadMoreFuture' => false,
            'targetMessageId' => null,
        ];
    }

    /**
     * Uma página de mensagens por id. `orderBy`/`limit` alteram a mesma
     * consulta (o Eloquent os repassa ao query builder); em instrução
     * separada, o `get()` é o do Builder de Message.
     *
     * @param Builder<Message> $query
     * @param 'asc'|'desc' $direction
     * @return Collection<int, Message>
     */
    private function rows(Builder $query, string $direction, int $limit): Collection
    {
        $query->orderBy('id', $direction)->limit($limit);

        return $query->get();
    }
}
