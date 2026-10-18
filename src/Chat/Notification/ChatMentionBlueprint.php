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

namespace Ramon\Canela\Chat\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;

/**
 * "Mencionado(a) no chat" — o `chat_mention` do Discourse.
 *
 * O assunto é quem mencionou, e não a mensagem: o NotificationResource do core
 * só serializa assuntos que têm um recurso do JSON:API, e o chat tem a própria
 * API. O que o alerta mostra (o canal) e o link vão nos dados — o id da
 * mensagem também, para cada menção ser uma notificação própria e para ela
 * sumir quando a mensagem é apagada. O `channelId` vem sempre primeiro: as
 * consultas que marcam como lida procuram pelo começo do JSON.
 */
final class ChatMentionBlueprint implements BlueprintInterface, AlertableInterface
{
    public const TYPE = 'canelaChatMention';

    /**
     * @param array{channelId: int, messageId: int, threadId: int|null, channelTitle: string, slug: string, kind: string} $data
     */
    public function __construct(
        public readonly User $sender,
        public readonly array $data,
    ) {
    }

    #[\Override]
    public function getSubject(): ?AbstractModel
    {
        return $this->sender;
    }

    #[\Override]
    public function getFromUser(): ?User
    {
        return $this->sender;
    }

    #[\Override]
    public function getData(): mixed
    {
        return $this->data;
    }

    #[\Override]
    public static function getType(): string
    {
        return self::TYPE;
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return User::class;
    }
}
