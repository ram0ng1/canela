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
use Flarum\Api\Context;
use Flarum\Api\Endpoint\Endpoint;
use Flarum\User\User;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Laminas\Diactoros\Response\EmptyResponse;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\MessageQuery;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Membership;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Pin;
use Ramon\Canela\Chat\Model\Thread;
use Ramon\Canela\Chat\Realtime\ChatBroadcaster;
use Ramon\Canela\Chat\Realtime\TypingStore;
use Ramon\Canela\Support\NullOrder;

/**
 * Os endpoints de ação do `chat-channels`, além do CRUD.
 *
 * - `GET /state`: os canais em que o ator está (os públicos que ele segue e
 *   as MDs abertas), com as não lidas — a barra lateral, a gaveta e o número
 *   do cabeçalho. Sem websocket, o fórum repete a chamada de tempos em tempos.
 * - `POST /direct` (`userIds`, `name`): abre (ou reabre) a MD.
 * - `POST|PATCH|DELETE /{id}/membership`: participar; silenciar, nível de
 *   aviso e favoritar; sair (ou fechar a MD).
 * - `GET|POST /{id}/members`: os membros (`filter[q]`, `page[offset]`) e
 *   adicionar pessoas (`userIds`).
 * - `POST /{id}/read` (`messageId`), `/{id}/typing` (`typing`, `threadId`)
 *   e `/{id}/pins-read`; `GET /{id}/pins`, as fixadas.
 * - `GET /{id}/updates` (`filter[after]`, `filter[since]`, `filter[thread]`):
 *   o polling sem websocket.
 *
 * Os parâmetros da URL vão em `filter[…]` e `page[…]`: o servidor JSON:API
 * recusa os nomes soltos (`?q=`), que a especificação reserva.
 *
 * O corpo das ações é um objeto JSON simples (não um documento JSON:API): é
 * uma ação, não um recurso sendo gravado. A resposta, quando há uma, é o
 * documento do recurso que mudou.
 */
final class ChannelEndpoints
{
    /** Membros por página na lista de membros. */
    private const MEMBERS_PAGE = 50;

    public static function state(): Endpoint
    {
        return Endpoint::make('state')
            ->route('GET', '/state')
            ->authenticated()
            ->action(static function (Context $context): Collection {
                ChatGate::check($context);
                $actor = $context->getActor();

                resolve(ChatService::class)->autoJoin($actor);

                $query = Channel::query()->whereVisibleTo($actor);
                $query->whereExists(static function ($exists) use ($actor) {
                    $exists->selectRaw('1')
                        ->from('canela_chat_memberships')
                        ->whereColumn('canela_chat_memberships.channel_id', 'canela_chat_channels.id')
                        ->where('canela_chat_memberships.user_id', $actor->id)
                        ->where('canela_chat_memberships.following', true);
                });
                NullOrder::orderBy($query, 'canela_chat_channels.name');

                return $query->limit(500)->get();
            })
            ->response(static fn (Context $context, Collection $channels) => ChatDocument::collection($context, ChannelResource::TYPE, $channels));
    }

    public static function direct(): Endpoint
    {
        return Endpoint::make('direct')
            ->route('POST', '/direct')
            ->authenticated()
            ->action(static function (Context $context): Channel {
                ChatGate::check($context);
                $body = self::body($context);

                return resolve(ChatService::class)->openDirect(
                    $context->getActor(),
                    array_map('intval', (array) ($body['userIds'] ?? [])),
                    isset($body['name']) && is_scalar($body['name']) ? (string) $body['name'] : null,
                );
            })
            ->response(static fn (Context $context, Channel $channel) => ChatDocument::single($context, ChannelResource::TYPE, $channel->refresh()));
    }

    /** @return Endpoint[] */
    public static function membership(): array
    {
        $make = static fn (string $name, string $method) => Endpoint::make("membership.$name")
            ->route($method, '/{id}/membership')
            ->authenticated()
            ->can('view')
            ->action(static function (Context $context) use ($method): ?Channel {
                ChatGate::check($context);
                /** @var Channel $channel */
                $channel = $context->model;
                $actor = $context->getActor();
                $service = resolve(ChatService::class);

                match ($method) {
                    'POST' => $service->follow($channel, $actor),
                    'PATCH' => $service->updateMembership($channel, $actor, self::body($context)),
                    default => $service->leave($channel, $actor),
                };

                // Sair de um grupo de MD tira o acesso: a resposta não pode mostrar o canal.
                return $method === 'DELETE' && $channel->isDirect() && $channel->is_group ? null : $channel;
            })
            ->response(static fn (Context $context, ?Channel $channel) => $channel
                ? ChatDocument::single($context, ChannelResource::TYPE, $channel->refresh())
                : new EmptyResponse(204));

        return [$make('create', 'POST'), $make('update', 'PATCH'), $make('delete', 'DELETE')];
    }

    /**
     * Os membros, em ordem de nome de usuário: os usuários são o `data`, e o
     * `meta` diz se há mais e quantos são ao todo. Numa MD entram todos; num
     * canal público, só quem o segue.
     */
    public static function members(): Endpoint
    {
        return Endpoint::make('members')
            ->route('GET', '/{id}/members')
            ->authenticated()
            ->can('view')
            ->action(static function (Context $context): array {
                ChatGate::check($context);
                /** @var Channel $channel */
                $channel = $context->model;
                $filter = self::filter($context);

                $query = Membership::query()
                    ->where('canela_chat_memberships.channel_id', $channel->id)
                    ->when(! $channel->isDirect(), static fn (Builder $q) => $q->where('canela_chat_memberships.following', true))
                    ->join('users', 'users.id', '=', 'canela_chat_memberships.user_id')
                    ->select('canela_chat_memberships.user_id')
                    ->orderBy('users.username');

                $term = trim(is_scalar($filter['q'] ?? null) ? (string) $filter['q'] : '');

                if ($term !== '') {
                    $query->whereLike('users.username', addcslashes($term, '\\%_').'%', caseSensitive: false);
                }

                $offset = max(0, (int) (self::page($context)['offset'] ?? 0));
                $ids = $query->offset($offset)->limit(self::MEMBERS_PAGE + 1)->pluck('user_id')->map(static fn ($id) => (int) $id);

                $users = User::query()->whereIn('id', $ids->take(self::MEMBERS_PAGE)->all() ?: [0])->get()
                    ->sortBy(static fn (User $u) => $ids->search($u->id))
                    ->values();

                return [
                    'users' => $users,
                    'hasMore' => $ids->count() > self::MEMBERS_PAGE,
                    'total' => $channel->isDirect() ? Membership::query()->where('channel_id', $channel->id)->count() : $channel->user_count,
                ];
            })
            ->response(static fn (Context $context, array $result) => ChatDocument::collection($context, 'users', $result['users'], [], [
                'hasMore' => $result['hasMore'],
                'total' => $result['total'],
            ]));
    }

    public static function addMembers(): Endpoint
    {
        return self::channelAction('members.add', 'POST', '/{id}/members', static function (Context $context, Channel $channel): void {
            resolve(ChatService::class)->addMembers($channel, $context->getActor(), (array) (self::body($context)['userIds'] ?? []));
        });
    }

    public static function read(): Endpoint
    {
        return self::channelAction('read', 'POST', '/{id}/read', static function (Context $context, Channel $channel): void {
            $body = self::body($context);

            resolve(ChatService::class)->markRead($channel, $context->getActor(), isset($body['messageId']) ? (int) $body['messageId'] : null);
        });
    }

    public static function pinsRead(): Endpoint
    {
        return self::channelAction('pins.read', 'POST', '/{id}/pins-read', static function (Context $context, Channel $channel): void {
            resolve(ChatService::class)->markPinsRead($channel, $context->getActor());
        }, respondWithChannel: false);
    }

    /**
     * "Está digitando": só avisa quem pode escrever aqui (não suspensos, canal
     * aberto), e só num fio deste canal. Cada aviso vira um push para o canal
     * todo: no máximo um por estado a cada 2 s (o fórum já manda a cada 4 s).
     */
    public static function typing(): Endpoint
    {
        return self::channelAction('typing', 'POST', '/{id}/typing', static function (Context $context, Channel $channel): void {
            $actor = $context->getActor();
            $body = self::body($context);
            $typing = (bool) ($body['typing'] ?? true);
            $threadId = isset($body['threadId']) ? (int) $body['threadId'] : null;

            if (! $actor->can('post', $channel)) {
                return;
            }

            if ($threadId !== null && ! Thread::query()->whereKey($threadId)->where('channel_id', $channel->id)->exists()) {
                return;
            }

            if (! resolve(Cache::class)->add("canela.chat.typing.{$channel->id}.{$actor->id}.".(int) $typing, 1, 2)) {
                return;
            }

            resolve(TypingStore::class)->set($channel->id, $threadId, (int) $actor->id, $typing);
            resolve(ChatBroadcaster::class)->toChannel($channel, [
                'type' => 'typing',
                'threadId' => $threadId,
                'userId' => $actor->id,
                'typing' => $typing,
                // O nome vai junto: quem está digitando pode não estar no
                // store de quem recebe, e o aviso não espera uma consulta.
                'username' => $actor->display_name,
            ], (int) $actor->id);
        }, respondWithChannel: false);
    }

    /** As fixadas do canal, da fixada mais recente para a mais antiga. */
    public static function pins(): Endpoint
    {
        return Endpoint::make('pins')
            ->route('GET', '/{id}/pins')
            ->authenticated()
            ->can('view')
            ->action(static function (Context $context): Collection {
                ChatGate::check($context);
                /** @var Channel $channel */
                $channel = $context->model;

                $order = Pin::query()->where('channel_id', $channel->id)->orderByDesc('created_at')->orderByDesc('id')->pluck('message_id')->map(static fn ($id) => (int) $id)->flip();

                return Message::query()
                    ->whereIn('id', $order->keys()->all() ?: [0])
                    ->whereNull('deleted_at')
                    ->get()
                    ->each(static fn (Message $m) => $m->setRelation('channel', $channel))
                    ->sortBy(static fn (Message $m) => $order[$m->id])
                    ->values();
            })
            ->response(static fn (Context $context, Collection $messages) => ChatDocument::collection($context, MessageResource::TYPE, $messages));
    }

    /**
     * O polling do modo sem websocket, numa chamada só: as mensagens novas
     * (depois de `after`), as que mudaram desde `since` (editadas, apagadas,
     * com reação ou fixadas — tudo isso mexe no `updated_at`) e quem está
     * digitando. `meta.now` volta para ser o próximo `since`, no relógio do
     * servidor, que é o que vale para o `updated_at`.
     *
     * O `data` traz as duas listas; `meta.newIds` diz quais são as novas.
     * `meta.removedIds` são as que sumiram para o ator (apagadas, para quem
     * não é a moderação nem o autor).
     */
    public static function updates(): Endpoint
    {
        return Endpoint::make('updates')
            ->route('GET', '/{id}/updates')
            ->authenticated()
            ->can('view')
            ->action(static function (Context $context): array {
                ChatGate::check($context);
                /** @var Channel $channel */
                $channel = $context->model;
                $actor = $context->getActor();
                $params = self::filter($context);
                $messages = resolve(MessageQuery::class);
                $now = Carbon::now();

                $threadId = (int) ($params['thread'] ?? 0);
                $thread = $threadId ? self::thread($threadId, $actor) : null;

                $after = (int) ($params['after'] ?? 0);
                $new = $messages->base($channel, $actor, $thread)->where('id', '>', $after)->orderBy('id')->limit(MessageQuery::MAX_LIMIT)->get();

                $changed = new Collection();
                $removed = [];
                $since = is_scalar($params['since'] ?? null) ? (string) $params['since'] : null;

                if ($since !== null && $after > 0) {
                    try {
                        $sinceAt = Carbon::parse($since)->subSecond();

                        // Até `after` inclusive: as mais novas já vieram em `new`.
                        $changed = $messages->base($channel, $actor, $thread)
                            ->where('id', '<=', $after)
                            ->where('updated_at', '>=', $sinceAt)
                            ->orderBy('id')
                            ->limit(MessageQuery::MAX_LIMIT)
                            ->get();

                        $removed = Message::query()
                            ->where('channel_id', $channel->id)
                            ->where('id', '<=', $after)
                            ->where('updated_at', '>=', $sinceAt)
                            ->whereNotNull('deleted_at')
                            ->whereNotIn('id', $changed->pluck('id')->all() ?: [0])
                            ->limit(MessageQuery::MAX_LIMIT)
                            ->pluck('id')
                            ->map(static fn ($id) => (int) $id)
                            ->all();
                    } catch (\Throwable) {
                        $changed = new Collection();
                    }
                }

                $typing = resolve(TypingStore::class)->get($channel->id, $thread?->id, (int) $actor->id);
                $all = $new->concat($changed)->each(static fn (Message $m) => $m->setRelation('channel', $channel));

                return [
                    'messages' => $all,
                    'meta' => [
                        'newIds' => $new->pluck('id')->map(static fn ($id) => (int) $id)->all(),
                        'removedIds' => $removed,
                        'typingUserIds' => $typing,
                        'now' => $now->toAtomString(),
                    ],
                    'typingUsers' => $typing ? User::query()->whereIn('id', $typing)->get() : [],
                ];
            })
            ->response(static fn (Context $context, array $result) => ChatDocument::collection($context, MessageResource::TYPE, $result['messages'], ['users' => []], $result['meta'], $result['typingUsers']));
    }

    /**
     * Uma ação sobre o canal que responde com o canal atualizado (ou 204).
     *
     * @param \Closure(Context, Channel): void $action
     */
    private static function channelAction(string $name, string $method, string $path, \Closure $action, bool $respondWithChannel = true): Endpoint
    {
        return Endpoint::make($name)
            ->route($method, $path)
            ->authenticated()
            ->can('view')
            ->action(static function (Context $context) use ($action): Channel {
                ChatGate::check($context);
                /** @var Channel $channel */
                $channel = $context->model;

                $action($context, $channel);

                return $channel;
            })
            ->response(static fn (Context $context, Channel $channel) => $respondWithChannel
                ? ChatDocument::single($context, ChannelResource::TYPE, $channel->refresh())
                : new EmptyResponse(204));
    }

    /** O fio pelo id, se o ator o enxerga (com os fios ligados); senão 404. */
    public static function thread(int $id, User $actor): Thread
    {
        /** @var Thread|null $thread */
        $thread = Thread::query()->whereVisibleTo($actor)->find($id);

        if (! $thread) {
            throw new ModelNotFoundException();
        }

        return $thread;
    }

    /** @return array<string, mixed> */
    public static function body(Context $context): array
    {
        $body = $context->body();

        return is_array($body) ? $body : [];
    }

    /** @return array<string, mixed> o `filter[…]` da URL */
    public static function filter(Context $context): array
    {
        $filter = $context->queryParam('filter');

        return is_array($filter) ? $filter : [];
    }

    /** @return array<string, mixed> o `page[…]` da URL */
    public static function page(Context $context): array
    {
        $page = $context->queryParam('page');

        return is_array($page) ? $page : [];
    }
}
