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
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatService;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Support\NullOrder;
use Tobyz\JsonApiServer\Context as OriginalContext;
use Tobyz\JsonApiServer\Pagination\OffsetPagination;
use Tobyz\JsonApiServer\Pagination\Pagination;

/**
 * `/api/chat-channels`: os canais do chat, públicos e MDs.
 *
 * - GET lista os públicos ("Navegar por todos os canais"), com os filtros
 *   `filter[status]` (all, open, closed, archived) e `filter[q]` (nome e
 *   descrição), 50 por página (`page[offset]`).
 * - POST cria um canal público (`canela.chat.createChannel`); GET, PATCH e
 *   DELETE em `/{id}` mostram, editam e excluem (ChannelPolicy).
 * - As ações (ChannelEndpoints): o estado da barra lateral, abrir uma MD, a
 *   participação, os membros, marcar como lido, "digitando", as fixadas e o
 *   polling.
 *
 * Os atributos que dependem do ator (participação, não lidas, o que ele pode
 * fazer) vêm em lote do ChatBatch; os usuários que eles citam vêm na relação
 * `users`, incluída por padrão.
 *
 * O tipo é o mesmo do ramon/chat (`chat-channels`): os dois nunca rodam
 * juntos — com o ramon/chat habilitado, o chat do tema nem carrega.
 *
 * @extends AbstractDatabaseResource<Channel>
 */
final class ChannelResource extends AbstractDatabaseResource
{
    use StashesInput;

    public const TYPE = 'chat-channels';

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
        return Channel::class;
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
                ->defaultInclude(['users'])
                ->paginate(50, 50)
                ->query(function (Builder $query, ?Pagination $pagination, Context $context, array $filters): Context {
                    $this->browse($query, $context, $filters);

                    if ($pagination instanceof OffsetPagination) {
                        $pagination->apply($query);
                    }

                    return $context->withQuery($query);
                }),
            ChannelEndpoints::state(),
            ChannelEndpoints::direct(),
            Endpoint\Show::make()
                ->authenticated()
                ->can('view')
                ->before(ChatGate::class)
                ->defaultInclude(['users']),
            Endpoint\Create::make()
                ->authenticated()
                // Antes da validação: quem não pode criar recebe 403, e não
                // os erros dos campos.
                ->before(ChatGate::class)
                ->before(function (Context $context): void {
                    if (! $this->access->canCreateChannel($context->getActor())) {
                        throw new PermissionDeniedException();
                    }
                })
                ->defaultInclude(['users']),
            Endpoint\Update::make()
                ->authenticated()
                ->can('edit')
                ->before(ChatGate::class)
                ->defaultInclude(['users']),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete')
                ->before(ChatGate::class),
            ...ChannelEndpoints::membership(),
            ChannelEndpoints::members(),
            ChannelEndpoints::addMembers(),
            ChannelEndpoints::read(),
            ChannelEndpoints::typing(),
            ChannelEndpoints::pins(),
            ChannelEndpoints::pinsRead(),
            ChannelEndpoints::updates(),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        $computed = static fn (string $key) => static fn (Channel $channel, Context $context) => ChatBatch::of($context)->attribute($channel, $key);

        return [
            // `type` é reservado no JSON:API (o tipo do recurso).
            Schema\Str::make('channelType')
                ->get(static fn (Channel $channel) => $channel->type),
            Schema\Boolean::make('isGroup'),
            Schema\Str::make('name')
                ->nullable()
                ->writable()
                // O canal público precisa de nome; o grupo de MD, não (e ele
                // não nasce por aqui, mas pelo `direct`).
                ->requiredOnCreate()
                ->maxLength(Channel::NAME_MAX_LENGTH)
                ->set($this->stash('name')),
            Schema\Str::make('slug')
                ->nullable()
                ->writable()
                ->get($computed('slug'))
                ->set($this->stash('slug')),
            Schema\Str::make('description')
                ->nullable()
                ->writable()
                ->maxLength(Channel::DESCRIPTION_MAX_LENGTH)
                ->set($this->stash('description')),
            Schema\Str::make('emoji')
                ->nullable()
                ->writable()
                ->set($this->stash('emoji')),
            Schema\Arr::make('tag')
                ->nullable()
                ->get($computed('tag')),
            // Só para criar: a tag aparece no `tag`, com nome, cor e ícone.
            Schema\Integer::make('tagId')
                ->nullable()
                ->writableOnCreate()
                ->hidden()
                ->set($this->stash('tagId')),
            Schema\Str::make('status')
                ->writableOnUpdate()
                ->in(Channel::STATUS_NAMES)
                ->get(static fn (Channel $channel) => $channel->statusName())
                ->set($this->stash('status')),
            Schema\Boolean::make('threadingEnabled')
                ->writable()
                ->get(fn (Channel $channel) => $this->access->threadsOn($channel))
                ->set($this->stash('threadingEnabled')),
            Schema\Boolean::make('allowChannelWideMentions')
                ->writable()
                ->set($this->stash('allowChannelWideMentions')),
            Schema\Boolean::make('autoJoin')
                ->writable()
                ->set($this->stash('autoJoin')),
            Schema\Integer::make('userCount'),
            Schema\Integer::make('messagesCount'),
            Schema\Integer::make('lastMessageId')
                ->nullable(),
            Schema\Arr::make('lastMessage')
                ->nullable()
                ->get($computed('lastMessage')),
            Schema\Arr::make('participantIds')
                ->get($computed('participantIds')),
            Schema\DateTime::make('createdAt'),
            Schema\Boolean::make('canModerate')
                ->get($computed('canModerate')),
            Schema\Boolean::make('canPost')
                ->get($computed('canPost')),
            Schema\Str::make('cannotPostReason')
                ->nullable()
                ->get($computed('cannotPostReason')),
            Schema\Boolean::make('canPin')
                ->get($computed('canPin')),
            Schema\Boolean::make('canEdit')
                ->get($computed('canEdit')),
            Schema\Boolean::make('canAddMembers')
                ->get($computed('canAddMembers')),
            Schema\Boolean::make('canDelete')
                ->get($computed('canDelete')),
            Schema\Arr::make('membership')
                ->nullable()
                ->get($computed('membership')),

            Schema\Relationship\ToMany::make('users')
                ->type('users')
                ->includable()
                ->get(static fn (Channel $channel, Context $context) => ChatBatch::of($context)->users($channel)),
        ];
    }

    /** O canal novo nasce do serviço, que já põe quem criou como participante. */
    #[\Override]
    public function create(object $model, OriginalContext $context): object
    {
        /** @var Context $context */
        return $this->service->createChannel($context->getActor(), $this->stashed($model));
    }

    #[\Override]
    public function update(object $model, OriginalContext $context): object
    {
        /** @var Context $context */
        return $this->service->updateChannel($model, $context->getActor(), $this->stashed($model));
    }

    /** Excluir leva o histórico inteiro (mensagens, fios, anexos). */
    #[\Override]
    public function delete(object $model, OriginalContext $context): void
    {
        /** @var Context $context */
        $this->service->deleteChannel($model, $context->getActor());
    }

    /**
     * A lista de "Navegar": só os públicos. "Tudo" para quem não modera
     * ainda deixa de fora os arquivados, que só interessam à moderação.
     *
     * @param Builder<Channel> $query
     * @param array<string, mixed> $filters
     */
    private function browse(Builder $query, Context $context, array $filters): void
    {
        $query->where('canela_chat_channels.type', Channel::TYPE_PUBLIC);

        $status = is_string($filters['status'] ?? null) ? $filters['status'] : 'all';
        $statusCode = array_search($status, Channel::STATUS_NAMES, true);

        if ($statusCode !== false) {
            $query->where('canela_chat_channels.status', $statusCode);
        } elseif (! $this->access->canModerate($context->getActor())) {
            $query->where('canela_chat_channels.status', '<>', Channel::STATUS_ARCHIVED);
        }

        $term = trim(is_string($filters['q'] ?? null) ? $filters['q'] : '');

        if ($term !== '') {
            $like = '%'.addcslashes($term, '\\%_').'%';
            $query->where(static fn (Builder $q) => $q->whereLike('canela_chat_channels.name', $like, caseSensitive: false)->orWhereLike('canela_chat_channels.description', $like, caseSensitive: false));
        }

        NullOrder::orderBy($query, 'canela_chat_channels.name');
        $query->orderBy('canela_chat_channels.id');
    }
}
