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

namespace Ramon\Canela\RamonChat\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;
use Ramon\Chat\Message;

/**
 * A base dos dois alertas do chat no sino (menção e mensagem nova), que o
 * ramon/chat deixou de fora de propósito ("o chat tem os próprios contadores").
 *
 * O assunto é a mensagem: cada uma vira um aviso próprio (o NotificationSyncer
 * casa o aviso pelo tipo, assunto, remetente e dados) e marcar o canal como
 * lido acha os avisos pelas mensagens dele.
 */
abstract class ChatActivityBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly Message $message,
    ) {
    }

    #[\Override]
    public function getSubject(): ?AbstractModel
    {
        return $this->message;
    }

    #[\Override]
    public function getFromUser(): ?User
    {
        return $this->message->user;
    }

    /** @return array<string, mixed> */
    #[\Override]
    public function getData(): array
    {
        $channel = $this->message->channel;

        return [
            'channelId' => (int) $this->message->channel_id,
            'threadId' => $this->message->thread_id !== null ? (int) $this->message->thread_id : null,
            'messageId' => (int) $this->message->id,
            // O nome guardado (o do canal, ou o do grupo); a MD sem nome usa o
            // nome de quem escreveu, que o aviso já tem.
            'channelName' => $channel?->name,
            'isDirect' => (bool) $channel?->isDirect(),
        ];
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return Message::class;
    }
}
