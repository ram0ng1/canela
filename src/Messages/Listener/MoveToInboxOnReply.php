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

namespace Ramon\Canela\Messages\Listener;

use Flarum\Messages\DialogMessage\Event\Created;
use Flarum\Messages\UserDialogState;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Messages\MessagesSchema;

/**
 * Uma resposta numa mensagem arquivada a traz de volta para a caixa de
 * entrada de todo mundo, como o `UserArchivedMessage.move_to_inbox!` do
 * Discourse: o arquivo guarda conversas encerradas, não esconde as que
 * voltaram a andar.
 */
final class MoveToInboxOnReply
{
    public function __construct(
        private readonly ConnectionInterface $db,
    ) {
    }

    public function handle(Created $event): void
    {
        if (! MessagesSchema::hasArchive($this->db) || ! $event->message->dialog_id) {
            return;
        }

        UserDialogState::query()
            ->where('dialog_id', $event->message->dialog_id)
            ->whereNotNull(MessagesSchema::ARCHIVED_COLUMN)
            ->update([MessagesSchema::ARCHIVED_COLUMN => null]);
    }
}
