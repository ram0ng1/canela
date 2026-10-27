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

namespace Ramon\Canela\Ai\Api;

use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Ai\Conversation;
use Ramon\Canela\Ai\Message;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * `canela-ai-messages`: as mensagens de uma conversa com o bot, só como
 * inclusão da conversa (`include=messages`). Não têm rotas próprias: nascem
 * no streaming da resposta e não se editam.
 *
 * O escopo é o da conversa — só as mensagens das conversas que o ator vê —,
 * e vale também na inclusão: o core aplica o escopo do recurso relacionado ao
 * carregar a relação.
 *
 * @extends AbstractDatabaseResource<Message>
 */
final class MessageResource extends AbstractDatabaseResource
{
    #[\Override]
    public function type(): string
    {
        return 'canela-ai-messages';
    }

    #[\Override]
    public function model(): string
    {
        return Message::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereIn(
            'canela_ai_messages.conversation_id',
            Conversation::query()->whereVisibleTo($context->getActor())->select('canela_ai_conversations.id')
        );
    }

    #[\Override]
    public function endpoints(): array
    {
        return [];
    }

    #[\Override]
    public function fields(): array
    {
        return [
            Schema\Str::make('role'),
            Schema\Str::make('content'),
            Schema\Arr::make('tools')
                ->get(static fn (Message $message): array => $message->tools ?? []),
            Schema\Str::make('model')->nullable(),
            Schema\DateTime::make('createdAt'),
        ];
    }
}
