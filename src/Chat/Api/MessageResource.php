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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\MessageQuery;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * `/api/chat-messages`: as mensagens do chat.
 *
 * - GET lista as de um canal (`filter[channel]`, obrigatório) ou de um fio
 *   (`filter[thread]`), por cursor: `page[before]`, `page[after]` ou
 *   `page[around]` (um id) e `page[limit]`. O `meta` diz se há mais para
 *   trás (`canLoadMorePast`) e para a frente (`canLoadMoreFuture`).
 * - POST envia (`message`, `inReplyToId`, `threadId`, `uploadIds` e a relação
 *   `channel`); GET, PATCH e DELETE em `/{id}` mostram, editam e apagam
 *   (MessagePolicy).
 * - Apagar é brando: a mensagem fica, recolhida, para o autor e a moderação,
 *   e por isso o DELETE responde com ela como ficou.
 * - As ações (MessageEndpoints): restaurar, reagir, fixar e a busca.
 *
 * @extends AbstractDatabaseResource<Message>
 */
final class MessageResource extends AbstractDatabaseResource
{
    use StashesInput;

    public const TYPE = 'chat-messages';

    /** A página do cursor, calculada na consulta e lida pelo `results()` e pelo `meta`. */
    private const PAGE = 'canela.chat.page';

    public function __construct(
        private readonly ChatService $service,
        private readonly MessageQuery $messages,
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
        return Message::class;
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
        $page = static fn (string $key) => static fn (Context $context) => $context->internal(self::PAGE)[$key] ?? null;

        return [
            Endpoint\Index::make()
                ->authenticated()
                ->before(ChatGate::class)
                ->defaultInclude(['users'])
                ->limit(MessageQuery::DEFAULT_LIMIT)
                ->maxLimit(MessageQuery::MAX_LIMIT)
                ->query(function (Builder $query, mixed $pagination, Context $context, array $filters): Context {
                    return $context->withInternal(self::PAGE, $this->page($context, $filters))->withQuery($query);
                })
                ->meta([
                    Schema\Boolean::make('canLoadMorePast')->get($page('canLoadMorePast')),
                    Schema\Boolean::make('canLoadMoreFuture')->get($page('canLoadMoreFuture')),
                    Schema\Integer::make('targetMessageId')->nullable()->get($page('targetMessageId')),
                ]),
            MessageEndpoints::search(),
            Endpoint\Show::make()
                ->authenticated()
                ->can('view')
                ->before(ChatGate::class)
                ->defaultInclude(['users']),
            Endpoint\Create::make()
                ->authenticated()
                ->before(ChatGate::class)
                ->defaultInclude(['users']),
            Endpoint\Update::make()
                ->authenticated()
                ->can('edit')
                ->before(ChatGate::class)
                ->defaultInclude(['users']),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete')
                ->before(ChatGate::class)
                ->response(static fn (Context $context) => ChatDocument::single($context, self::TYPE, $context->model->refresh())),
            MessageEndpoints::restore(),
            MessageEndpoints::react(),
            ...MessageEndpoints::pin(),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        $computed = static fn (string $key) => static fn (Message $message, Context $context) => ChatBatch::of($context)->attribute($message, $key);

        return [
            Schema\Integer::make('channelId'),
            Schema\Integer::make('threadId')
                ->nullable()
                ->writableOnCreate()
                ->get($computed('threadId'))
                ->set($this->stash('threadId')),
            Schema\Boolean::make('isThreadOriginal')
                ->get($computed('isThreadOriginal')),
            Schema\Integer::make('userId')
                ->nullable(),
            // O tamanho e o "não vazia" dependem do admin e dos anexos: o
            // ChatService confere, com o erro neste mesmo campo.
            Schema\Str::make('message')
                ->nullable()
                ->writable()
                ->get($computed('message'))
                ->set($this->stash('message')),
            Schema\Str::make('cooked')
                ->get($computed('cooked')),
            Schema\Str::make('excerpt')
                ->get($computed('excerpt')),
            Schema\DateTime::make('createdAt'),
            Schema\DateTime::make('editedAt')
                ->nullable(),
            Schema\DateTime::make('deletedAt')
                ->nullable(),
            Schema\Integer::make('deletedById')
                ->nullable(),
            Schema\Arr::make('inReplyTo')
                ->nullable()
                ->get($computed('inReplyTo')),
            Schema\Integer::make('inReplyToId')
                ->nullable()
                ->writableOnCreate()
                ->hidden()
                ->set($this->stash('inReplyToId')),
            Schema\Arr::make('reactions')
                ->get($computed('reactions')),
            Schema\Arr::make('uploads')
                ->get($computed('uploads')),
            // Os anexos já enviados (POST /api/chat/uploads) que vão na mensagem.
            Schema\Arr::make('uploadIds')
                ->nullable()
                ->writable()
                ->hidden()
                ->set($this->stash('uploadIds')),
            Schema\Boolean::make('pinned')
                ->get($computed('pinned')),
            Schema\Integer::make('pinnedById')
                ->nullable()
                ->get($computed('pinnedById')),
            Schema\Str::make('pinnedAt')
                ->nullable()
                ->get($computed('pinnedAt')),
            Schema\Arr::make('thread')
                ->nullable()
                ->get($computed('thread')),
            Schema\Boolean::make('canEdit')
                ->get($computed('canEdit')),
            Schema\Boolean::make('canDelete')
                ->get($computed('canDelete')),
            Schema\Boolean::make('canRestore')
                ->get($computed('canRestore')),

            Schema\Relationship\ToOne::make('channel')
                ->type(ChannelResource::TYPE)
                ->includable()
                ->writableOnCreate()
                ->requiredOnCreate()
                ->set($this->stash('channel')),
            Schema\Relationship\ToMany::make('users')
                ->type('users')
                ->includable()
                ->get(static fn (Message $message, Context $context) => ChatBatch::of($context)->users($message)),
        ];
    }

    /**
     * A página já veio pronta da consulta (o cursor pede mais de uma consulta,
     * e o `meta` precisa do que elas acharam).
     */
    #[\Override]
    public function results(object $query, OriginalContext $context): iterable
    {
        /** @var Context $context */
        $page = $context->internal(self::PAGE);

        return $page ? $page['messages'] : parent::results($query, $context);
    }

    /** O cursor não tem total: contar todas as mensagens do canal seria só custo. */
    #[\Override]
    public function count(object $query, OriginalContext $context): ?int
    {
        return null;
    }

    #[\Override]
    public function create(object $model, OriginalContext $context): object
    {
        /** @var Context $context */
        $input = $this->stashed($model);
        /** @var Channel $channel */
        $channel = $input['channel'];

        return $this->service->createMessage(
            $channel,
            $context->getActor(),
            (string) ($input['message'] ?? ''),
            isset($input['inReplyToId']) ? (int) $input['inReplyToId'] : null,
            isset($input['threadId']) ? (int) $input['threadId'] : null,
            array_map('intval', (array) ($input['uploadIds'] ?? [])),
        );
    }

    #[\Override]
    public function update(object $model, OriginalContext $context): object
    {
        /** @var Context $context */
        $input = $this->stashed($model);

        return $this->service->updateMessage(
            $model,
            $this->channelOf($model),
            $context->getActor(),
            (string) ($input['message'] ?? ''),
            array_key_exists('uploadIds', $input) ? array_map('intval', (array) $input['uploadIds']) : null,
        );
    }

    /** Apagar é brando: a linha fica, com quem apagou e quando. */
    #[\Override]
    public function delete(object $model, OriginalContext $context): void
    {
        /** @var Context $context */
        $this->service->deleteMessage($model, $this->channelOf($model), $context->getActor());
    }

    private function channelOf(Message $message): Channel
    {
        /** @var Channel|null $channel */
        $channel = $message->channel;

        if (! $channel) {
            throw new ModelNotFoundException();
        }

        return $channel;
    }

    /**
     * A página do cursor para o canal (e o fio) do filtro: os dois têm de
     * existir para o ator, senão 404.
     *
     * @param array<string, mixed> $filters
     * @return array{messages: \Illuminate\Support\Collection<int, Message>, canLoadMorePast: bool, canLoadMoreFuture: bool, targetMessageId: int|null}
     */
    private function page(Context $context, array $filters): array
    {
        $actor = $context->getActor();

        /** @var Channel|null $channel */
        $channel = Channel::query()->whereVisibleTo($actor)->find((int) ($filters['channel'] ?? 0));

        if (! $channel) {
            throw new ModelNotFoundException();
        }

        $actor->assertCan('view', $channel);

        $threadId = (int) ($filters['thread'] ?? 0);
        $thread = $threadId ? ChannelEndpoints::thread($threadId, $actor) : null;

        $params = $context->queryParam('page');
        $result = $this->messages->fetch($channel, $actor, $thread, is_array($params) ? $params : []);

        foreach ($result['messages'] as $message) {
            $message->setRelation('channel', $channel);
        }

        return $result;
    }
}
