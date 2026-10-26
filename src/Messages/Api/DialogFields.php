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

namespace Ramon\Canela\Messages\Api;

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Schema;
use Flarum\Messages\Dialog;
use Flarum\Messages\UserDialogState;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Messages\DialogEvents;
use Ramon\Canela\Messages\MessagesSchema;
use Ramon\Canela\Messages\StaffGroups;

/**
 * O que o tópico de mensagem mostra e o flarum/messages não tem:
 *
 * - `viewCount`: as visualizações (RecordDialogView conta).
 * - `canelaTitle`: o título da mensagem (o Flarum só tem "Conversando com X").
 * - `canelaArchived`: se a conversa está no meu arquivo — e, gravado, o botão
 *   "Arquivar" / "Mover para caixa de entrada" do rodapé.
 *
 * A coluna "Respostas" da lista não precisa de contagem própria: o número da
 * última mensagem (`dialog_messages.number`, sequencial) já é o total.
 */
final class DialogFields
{
    public function __construct(
        private readonly ConnectionInterface $db,
    ) {
    }

    /**
     * @return array<int, Schema\Attribute>
     */
    public function __invoke(): array
    {
        return [
            // As visualizações (a coluna da lista); `null` sem a migration.
            Schema\Integer::make('viewCount')
                ->nullable()
                ->get(fn (Dialog $dialog): ?int => MessagesSchema::hasViews($this->db)
                    ? (int) ($dialog->getAttribute(MessagesSchema::VIEWS_COLUMN) ?? 0)
                    : null),

            // A caixa de grupo da conversa (a equipe), para o chip sob o título.
            Schema\Integer::make('canelaGroupId')
                ->nullable()
                ->get(fn (Dialog $dialog): ?int => MessagesSchema::hasGroups($this->db) && $dialog->getAttribute(MessagesSchema::GROUP_COLUMN)
                    ? (int) $dialog->getAttribute(MessagesSchema::GROUP_COLUMN)
                    : null),

            // O nível de notificação da pessoa nesta conversa (3 Observando,
            // 2 Acompanhando, 1 Normal, 0 Silenciado); vazio = Observando.
            Schema\Integer::make('canelaNotificationLevel')
                ->nullable()
                ->visible(fn (Dialog $dialog): bool => $dialog->state !== null && MessagesSchema::hasGroups($this->db))
                ->get(fn (Dialog $dialog): int => (int) ($dialog->state?->getAttribute(MessagesSchema::LEVEL_COLUMN) ?? 3))
                ->writableOnUpdate()
                ->save(function (Dialog $dialog, mixed $value, Context $context): void {
                    if (! MessagesSchema::hasGroups($this->db)) {
                        return;
                    }

                    $level = max(0, min(3, (int) $value));

                    UserDialogState::query()
                        ->where('dialog_id', $dialog->id)
                        ->where('user_id', $context->getActor()->id)
                        ->update([MessagesSchema::LEVEL_COLUMN => $level]);

                    $dialog->state?->setAttribute(MessagesSchema::LEVEL_COLUMN, $level);
                }),

            // Os posts de ação pequena (convidou/removeu), só na conversa aberta.
            Schema\Arr::make('canelaEvents')
                ->visible(fn (Dialog $dialog, Context $context): bool => $context->endpoint instanceof Endpoint\Show)
                ->get(fn (Dialog $dialog): array => resolve(DialogEvents::class)->forDialog((int) $dialog->id)),

            // Quem pode tirar os outros da conversa (a equipe ou quem começou).
            Schema\Boolean::make('canelaCanRemove')
                ->visible(fn (Dialog $dialog, Context $context): bool => $context->endpoint instanceof Endpoint\Show)
                ->get(fn (Dialog $dialog, Context $context): bool => StaffGroups::isStaff($context->getActor())
                    || (int) ($dialog->firstMessage->user_id ?? 0) === (int) $context->getActor()->id),

            Schema\Str::make('canelaTitle')
                ->nullable()
                ->get(fn (Dialog $dialog): ?string => MessagesSchema::hasTitle($this->db)
                    ? ($dialog->getAttribute(MessagesSchema::TITLE_COLUMN) ?: null)
                    : null),

            Schema\Boolean::make('canelaArchived')
                ->visible(fn (Dialog $dialog): bool => $dialog->state !== null)
                ->get(fn (Dialog $dialog): bool => MessagesSchema::hasArchive($this->db)
                    && $dialog->state?->getAttribute(MessagesSchema::ARCHIVED_COLUMN) !== null)
                ->writableOnUpdate()
                // O arquivo é da linha da pessoa na conversa, não da conversa:
                // gravado depois do resto, direto na `dialog_user`.
                ->save(function (Dialog $dialog, mixed $value, Context $context): void {
                    if (! MessagesSchema::hasArchive($this->db)) {
                        return;
                    }

                    $archivedAt = $value ? Carbon::now() : null;

                    UserDialogState::query()
                        ->where('dialog_id', $dialog->id)
                        ->where('user_id', $context->getActor()->id)
                        ->update([MessagesSchema::ARCHIVED_COLUMN => $archivedAt]);

                    $dialog->state?->setAttribute(MessagesSchema::ARCHIVED_COLUMN, $archivedAt);
                }),
        ];
    }
}
