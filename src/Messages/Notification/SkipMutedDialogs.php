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

namespace Ramon\Canela\Messages\Notification;

use Flarum\Messages\Notification\MessageReceivedBlueprint;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Messages\MessagesSchema;

/**
 * O nível "Silenciado" da mensagem (controle de notificação do rodapé): quem
 * silenciou a conversa não recebe o aviso de mensagem nova dela. Observando,
 * Acompanhando e Normal continuam avisando — no flarum/messages todo aviso de
 * mensagem é "para você".
 */
final class SkipMutedDialogs
{
    public function __construct(
        private readonly ConnectionInterface $db,
    ) {
    }

    /**
     * @param User[] $recipients
     * @return User[]
     */
    public function __invoke(BlueprintInterface $blueprint, array $recipients): array
    {
        if (! $blueprint instanceof MessageReceivedBlueprint || ! $recipients || ! MessagesSchema::hasGroups($this->db)) {
            return $recipients;
        }

        $muted = $this->db->table(MessagesSchema::STATE_TABLE)
            ->where('dialog_id', $blueprint->message->dialog_id)
            ->where(MessagesSchema::LEVEL_COLUMN, 0)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (! $muted) {
            return $recipients;
        }

        return array_values(array_filter($recipients, fn (User $user) => ! in_array((int) $user->id, $muted, true)));
    }
}
