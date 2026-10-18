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

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Messages\DialogMessage;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Messages\MessagesSchema;

/**
 * O campo "Título" do composer de mensagem do Discourse.
 *
 * O flarum/messages cria a conversa dentro do envio da primeira mensagem
 * (não há endpoint de "nova conversa"), então o título viaja com ela, como um
 * atributo só de escrita, e é gravado na conversa depois que a mensagem foi
 * salva. Só vale para uma conversa que ainda não tem título: no Flarum há uma
 * conversa por par de pessoas, e uma "nova mensagem" para alguém com quem já
 * se conversa cai na mesma conversa — o título dela não muda por isso.
 */
final class DialogMessageFields
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
            // Os outros destinatários (a API do flarum/messages aceita um em
            // `users`): só de escrita, lidos por CreateGroupConversation.
            Schema\Arr::make('canelaUsers')
                ->nullable()
                ->hidden()
                ->writableOnCreate()
                ->set(static fn () => null),

            Schema\Str::make('canelaTitle')
                ->nullable()
                ->hidden()
                ->writableOnCreate()
                ->maxLength(MessagesSchema::TITLE_MAX)
                ->save(function (DialogMessage $message, ?string $value, Context $context): void {
                    $title = trim((string) $value);
                    $dialog = $message->dialog;

                    if ($title === '' || ! $dialog || ! MessagesSchema::hasTitle($this->db)) {
                        return;
                    }

                    if ($dialog->getAttribute(MessagesSchema::TITLE_COLUMN)) {
                        return;
                    }

                    // Direto na tabela: salvar o modelo dispararia de novo os
                    // eventos da conversa por causa de um texto.
                    $this->db->table(MessagesSchema::DIALOG_TABLE)
                        ->where('id', $dialog->id)
                        ->update([MessagesSchema::TITLE_COLUMN => mb_substr($title, 0, MessagesSchema::TITLE_MAX)]);

                    $dialog->setAttribute(MessagesSchema::TITLE_COLUMN, $title);
                }),
        ];
    }
}
