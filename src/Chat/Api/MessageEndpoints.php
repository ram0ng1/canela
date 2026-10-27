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

use Flarum\Api\Context;
use Flarum\Api\Endpoint\Endpoint;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;

/**
 * Os endpoints de ação do `chat-messages`, além do CRUD.
 *
 * - `POST /{id}/restore`: "Restaurar mensagem excluída".
 * - `POST /{id}/reactions` (`emoji`, `action`: add|remove).
 * - `POST|DELETE /{id}/pin`: fixar e desafixar.
 * - `GET /search` (`filter[q]`, `filter[channel]`; `sort=-createdAt` para as
 *   mais novas, senão por relevância): "Pesquisar no chat", nos canais que o
 *   ator enxerga, com o canal de cada resultado incluído (a lista mostra o
 *   nome dele).
 *
 * Quem pode cada coisa é da MessagePolicy, que o ChatService consulta; aqui
 * só se acha a mensagem (que o escopo já esconde de quem não a enxerga) e se
 * devolve como ela ficou.
 */
final class MessageEndpoints
{
    private const SEARCH_LIMIT = 25;

    public static function restore(): Endpoint
    {
        return self::action('restore', 'POST', '/{id}/restore', static function (Context $context, Message $message, Channel $channel): void {
            resolve(ChatService::class)->restoreMessage($message, $channel, $context->getActor());
        });
    }

    public static function react(): Endpoint
    {
        return self::action('reactions', 'POST', '/{id}/reactions', static function (Context $context, Message $message, Channel $channel): void {
            $body = ChannelEndpoints::body($context);
            $emoji = is_scalar($body['emoji'] ?? null) ? (string) $body['emoji'] : '';

            resolve(ChatService::class)->react($message, $channel, $context->getActor(), $emoji, ($body['action'] ?? 'add') !== 'remove');
        });
    }

    /** @return Endpoint[] */
    public static function pin(): array
    {
        $make = static fn (string $name, string $method) => self::action($name, $method, '/{id}/pin', static function (Context $context, Message $message, Channel $channel) use ($method): void {
            resolve(ChatService::class)->pin($message, $channel, $context->getActor(), $method === 'POST');
        });

        return [$make('pin', 'POST'), $make('unpin', 'DELETE')];
    }

    /**
     * Busca por trecho no texto digitado (não no HTML, que casaria com nomes
     * de tags e atributos). "Relevância" põe primeiro as que têm o termo como
     * palavra inteira; "Últimos", as mais novas.
     */
    public static function search(): Endpoint
    {
        return Endpoint::make('search')
            ->route('GET', '/search')
            ->authenticated()
            ->action(static function (Context $context): Collection {
                ChatGate::check($context);
                $actor = $context->getActor();
                $params = ChannelEndpoints::filter($context);
                $term = trim(is_scalar($params['q'] ?? null) ? (string) $params['q'] : '');

                if (mb_strlen($term) < 2) {
                    return new Collection();
                }

                $channels = Channel::query()->whereVisibleTo($actor);
                $channelId = (int) ($params['channel'] ?? 0);

                if ($channelId) {
                    $channels->where('canela_chat_channels.id', $channelId);
                }

                $channels = $channels->get()->keyBy('id');

                $query = Message::query()
                    ->whereIn('channel_id', $channels->keys()->all() ?: [0])
                    ->whereNull('deleted_at')
                    // Sem diferenciar maiúsculas em nenhum banco: no PostgreSQL vira
                    // ILIKE (o LIKE de lá diferencia), no MySQL/MariaDB/SQLite, LIKE.
                    ->whereLike('message', '%'.addcslashes($term, '\\%_').'%', caseSensitive: false)
                    ->limit(self::SEARCH_LIMIT);

                if ($context->queryParam('sort') !== '-createdAt') {
                    // Palavra inteira primeiro. Com LIKE, não REGEXP: o REGEXP não existe
                    // no PostgreSQL nem no SQLite, e a borda de palavra muda entre MySQL
                    // e MariaDB.
                    $message = 'LOWER('.$query->getQuery()->getGrammar()->wrap('message').')';
                    $word = mb_strtolower(addcslashes($term, '\\%_'));
                    $query->orderByRaw(
                        "CASE WHEN $message = ? OR $message LIKE ? OR $message LIKE ? OR $message LIKE ? THEN 0 ELSE 1 END",
                        [mb_strtolower($term), $word.' %', '% '.$word, '% '.$word.' %']
                    );
                }

                $messages = $query->orderByDesc('id')->get();

                foreach ($messages as $message) {
                    $message->setRelation('channel', $channels->get($message->channel_id));
                }

                return $messages;
            })
            ->response(static fn (Context $context, Collection $messages) => ChatDocument::collection($context, MessageResource::TYPE, $messages, ['users' => [], 'channel' => ['users' => []]]));
    }

    /**
     * Uma ação sobre a mensagem que responde com ela como ficou.
     *
     * @param \Closure(Context, Message, Channel): void $action
     */
    private static function action(string $name, string $method, string $path, \Closure $action): Endpoint
    {
        return Endpoint::make($name)
            ->route($method, $path)
            ->authenticated()
            ->can('view')
            ->action(static function (Context $context) use ($action): Message {
                ChatGate::check($context);
                /** @var Message $message */
                $message = $context->model;
                /** @var Channel|null $channel */
                $channel = $message->channel;

                if (! $channel) {
                    throw new ModelNotFoundException();
                }

                $action($context, $message, $channel);

                return $message;
            })
            ->response(static fn (Context $context, Message $message) => ChatDocument::single($context, MessageResource::TYPE, $message->refresh()));
    }
}
