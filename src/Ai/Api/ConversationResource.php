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

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Locale\TranslatorInterface;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Conversation;
use Ramon\Canela\Ai\Http\AiGate;
use Ramon\Canela\Ai\Message;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * `/api/canela-ai-conversations`: as conversas da pessoa com o bot.
 *
 * - GET lista, da mais recente para a mais antiga, em páginas de 50 (a barra
 *   lateral da página de conversas carrega mais ao rolar até o fim). Só as
 *   que já têm mensagem: a conversa nasce um instante antes da primeira.
 * - GET `/{id}` traz a conversa com as mensagens (`messages`, em ordem).
 * - PATCH troca o título; DELETE apaga a conversa com as mensagens.
 * - A conversa nasce e cresce pelo `POST /api/canela/ai/conversations/reply`,
 *   que responde em streaming e por isso não é um endpoint daqui.
 *
 * O escopo restringe tudo à dona (ScopeConversationVisibility): a conversa de
 * outra pessoa responde 404, e não 403 — nem a existência dela é da conta de
 * quem pergunta. Com o bot desligado tudo responde 404; sem a permissão
 * `canela.useAi`, 403.
 *
 * @extends AbstractDatabaseResource<Conversation>
 */
final class ConversationResource extends AbstractDatabaseResource
{
    public const PAGE_SIZE = 50;

    public const TITLE_MAX_LENGTH = 120;

    #[\Override]
    public function type(): string
    {
        return 'canela-ai-conversations';
    }

    #[\Override]
    public function model(): string
    {
        return Conversation::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereVisibleTo($context->getActor());

        // A lista só mostra conversas com mensagem; abrir uma pelo id, não importa.
        if ($context->endpoint instanceof Endpoint\Index) {
            $query->where('canela_ai_conversations.message_count', '>', 0);
        }
    }

    #[\Override]
    public function endpoints(): array
    {
        // `before` roda depois do 401 do `authenticated()` e, nos endpoints com
        // id, depois de achar a conversa: com o bot desligado tudo vira 404.
        $gate = static function (Context $context): void {
            /** @var AiGate $gate */
            $gate = resolve(AiGate::class);
            $gate->feature(AiSettings::BOT);
            $gate->user($context->getActor());
        };

        return [
            Endpoint\Index::make()
                ->authenticated()
                ->before($gate)
                ->defaultSort('-updatedAt')
                ->paginate(self::PAGE_SIZE, self::PAGE_SIZE),
            Endpoint\Show::make()
                ->authenticated()
                ->before($gate)
                ->defaultInclude(['messages'])
                ->eagerLoadWhere('messages', static fn ($query) => $query->orderBy('canela_ai_messages.id')),
            Endpoint\Update::make()
                ->authenticated()
                ->can('edit')
                ->before($gate),
            Endpoint\Delete::make()
                ->authenticated()
                ->can('delete')
                ->before($gate),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        $invalidTitle = resolve(TranslatorInterface::class)->trans('ramon-canela.api.ai.errors.invalid_title');

        return [
            // Só se renomeia: o título da conversa nova vem do modelo rápido.
            // Só espaços conta como vazio (o `required` do Laravel apara).
            Schema\Str::make('title')
                ->nullable()
                ->writable(static fn (Conversation $conversation, Context $context): bool => $context->updating())
                ->required()
                ->maxLength(self::TITLE_MAX_LENGTH)
                ->validationMessages(['title.required' => $invalidTitle, 'title.max' => $invalidTitle, 'title.string' => $invalidTitle])
                ->set(static function (Conversation $conversation, ?string $value): void {
                    $conversation->title = trim((string) $value);
                }),
            Schema\Str::make('persona')->nullable(),
            Schema\Integer::make('messageCount'),
            Schema\DateTime::make('createdAt'),
            Schema\DateTime::make('updatedAt'),

            Schema\Relationship\ToMany::make('messages')
                ->type('canela-ai-messages')
                ->includable(),
        ];
    }

    #[\Override]
    public function sorts(): array
    {
        return [
            SortColumn::make('updatedAt'),
        ];
    }

    /** Renomear não é atividade: a conversa não sobe para o topo da lista. */
    #[\Override]
    public function updating(object $model, OriginalContext $context): object
    {
        $model->timestamps = false;

        return $model;
    }

    /**
     * As mensagens saem antes, às claras: a chave estrangeira em cascata faria
     * isso, mas o SQLite sem `foreign_keys` não a cumpre.
     */
    #[\Override]
    public function deleting(object $model, OriginalContext $context): void
    {
        Message::query()->where('conversation_id', $model->id)->delete();
    }
}
