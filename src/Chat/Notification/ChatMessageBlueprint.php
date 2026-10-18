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
 * "Nova mensagem de chat": a mensagem direta (e a dos canais em "Para todas as
 * atividades").
 *
 * Uma notificação por conversa e remetente: os dados levam só o canal, então
 * cinco mensagens seguidas de alguém não viram cinco alertas — o core reconhece
 * a notificação como a mesma e só a mantém. Ler a conversa marca como lida, e a
 * próxima mensagem depois disso alerta de novo (o ChatNotifier apaga a lida).
 */
final class ChatMessageBlueprint implements BlueprintInterface, AlertableInterface
{
    public const TYPE = 'canelaChatMessage';

    /**
     * @param array{channelId: int, slug: string, isDirect: bool, name: string|null} $data
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
