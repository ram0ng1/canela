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
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Thread;
use Ramon\Canela\Chat\Model\ThreadMembership;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * `/api/chat-threads`: os fios do chat.
 *
 * - GET lista os fios de um canal (`filter[channel]`, do mais recente para o
 *   mais antigo) ou, sem o filtro, "Meus tópicos": os que o ator acompanha,
 *   em todos os canais que ele ainda enxerga. No máximo 50.
 * - GET e PATCH em `/{id}`: o fio (título, original, participantes, o
 *   acompanhamento do ator); o título (ThreadPolicy::rename) e o nível de aviso.
 * - `POST /{id}/read` (`messageId`): marca lido.
 *
 * A original e o canal vêm incluídos por padrão: a lista mostra os dois.
 *
 * @extends AbstractDatabaseResource<Thread>
 */
final class ThreadResource extends AbstractDatabaseResource
{
    use StashesInput;

    public const TYPE = 'chat-threads';

    private const LIMIT = 50;

    /** O canal com os participantes: o título de uma MD ("Ana, Bruno") sai deles. */
    private const INCLUDE = ['users', 'originalMessage', 'originalMessage.users', 'channel', 'channel.users'];

    public function __construct(
        private readonly ChatService $service,
        private readonly ChatAccess $access,
    ) {
    }

    #[\Override]
    public function type(): string
    {
        return self::TYPE;
    }

    #[\Override]
    public function model(): string
    {
        return Thread::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        /** @var Context $context */
        $query->whereVisibleTo($context->getActor());
    }

    #[\Override]
    public function endpoints(): array
    {
        return [
            Endpoint\Index::make()
                ->authenticated()
                ->before(ChatGate::class)
                ->defaultInclude(self::INCLUDE)
                ->query(function (Builder $query, mixed $pagination, Context $context, array $filters): Context {
                    $this->list($query, $context->getActor(), $filters);

                    return $context->withQuery($query);
                }),
            Endpoint\Show::make()
                ->authenticated()
                ->can('view')
                ->before(ChatGate::class)
                ->defaultInclude(self::INCLUDE),
            Endpoint\Update::make()
                ->authenticated()
                ->can('view')
                ->before(ChatGate::class)
                ->defaultInclude(self::INCLUDE),
            Endpoint\Endpoint::make('read')
                ->route('POST', '/{id}/read')
                ->authenticated()
                ->can('view')
                ->action(function (Context $context): Thread {
                    ChatGate::check($context);
                    /** @var Thread $thread */
                    $thread = $context->model;
                    $body = ChannelEndpoints::body($context);

                    $this->service->markThreadRead($thread, $context->getActor(), isset($body['messageId']) ? (int) $body['messageId'] : null);

                    return $thread;
                })
                ->response(static fn (Context $context, Thread $thread) => ChatDocument::single($context, self::TYPE, $thread->refresh(), [
                    'users' => [],
                    'originalMessage' => ['users' => []],
                    'channel' => ['users' => []],
                ])),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        $computed = static fn (string $key) => static fn (Thread $thread, Context $context) => ChatBatch::of($context)->attribute($thread, $key);

        return [
            Schema\Str::make('title')
                ->nullable()
                ->writable()
                ->set($this->stash('title')),
            // Só para gravar: o nível do ator volta em `membership`.
            Schema\Str::make('notificationLevel')
                ->writable()
                ->hidden()
                ->set($this->stash('notificationLevel')),
            Schema\Integer::make('channelId'),
            Schema\Integer::make('replyCount')
                ->get($computed('replyCount')),
            Schema\Integer::make('lastReplyId')
                ->nullable()
                ->get($computed('lastReplyId')),
            Schema\Integer::make('lastReplyUserId')
                ->nullable()
                ->get($computed('lastReplyUserId')),
            Schema\Str::make('lastReplyExcerpt')
                ->get($computed('lastReplyExcerpt')),
            Schema\Str::make('lastReplyCreatedAt')
                ->nullable()
                ->get($computed('lastReplyCreatedAt')),
            Schema\Arr::make('participantIds')
                ->get($computed('participantIds')),
            Schema\Integer::make('participantCount')
                ->get($computed('participantCount')),
            Schema\Boolean::make('canRename')
                ->get($computed('canRename')),
            Schema\Arr::make('membership')
                ->nullable()
                ->get($computed('membership')),

            Schema\Relationship\ToOne::make('originalMessage')
                ->type(MessageResource::TYPE)
                ->includable(),
            Schema\Relationship\ToOne::make('channel')
                ->type(ChannelResource::TYPE)
                ->includable(),
            Schema\Relationship\ToMany::make('users')
                ->type('users')
                ->includable()
                ->get(static fn (Thread $thread, Context $context) => ChatBatch::of($context)->users($thread)),
        ];
    }

    /** Sem paginação, o total não serve para nada. */
    #[\Override]
    public function count(object $query, OriginalContext $context): ?int
    {
        return null;
    }

    #[\Override]
    public function update(object $model, OriginalContext $context): object
    {
        /** @var Context $context */
        /** @var Channel|null $channel */
        $channel = $model->channel;

        if (! $channel) {
            throw new ModelNotFoundException();
        }

        return $this->service->updateThread($model, $channel, $context->getActor(), $this->stashed($model));
    }

    /**
     * Os fios de um canal (com respostas e com a original ainda lá), ou os
     * que o ator acompanha. O escopo já deixa de fora os canais que ele não
     * enxerga e os sem fios.
     *
     * @param Builder<Thread> $query
     * @param array<string, mixed> $filters
     */
    private function list(Builder $query, User $actor, array $filters): void
    {
        $query->where('canela_chat_threads.replies_count', '>', 0);

        if (isset($filters['channel'])) {
            /** @var Channel|null $channel */
            $channel = Channel::query()->whereVisibleTo($actor)->find((int) $filters['channel']);

            if (! $channel || ! $this->access->threadsOn($channel)) {
                throw new ModelNotFoundException();
            }

            $actor->assertCan('view', $channel);

            $query->where('canela_chat_threads.channel_id', $channel->id)
                ->whereHas('originalMessage', static fn ($q) => $q->whereNull('deleted_at'));
        } else {
            $query->whereIn(
                'canela_chat_threads.id',
                ThreadMembership::query()
                    ->select('thread_id')
                    ->where('user_id', $actor->id)
                    ->where('notification_level', '>', Thread::LEVEL_MUTED)
            );
        }

        $query->orderByDesc('canela_chat_threads.last_message_id')->limit(self::LIMIT);
    }
}
