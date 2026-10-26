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

namespace Ramon\Canela\Messages\Reactions;

use Flarum\Database\AbstractModel;
use Flarum\Messages\DialogMessage;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;

/**
 * "Fulano reagiu à sua mensagem": o aviso
 * para o autor da mensagem privada, com a reação escolhida nos dados.
 */
final class MessageReactedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public DialogMessage $message,
        public User $user,
        public string $reaction,
    ) {
    }

    #[\Override]
    public static function getType(): string
    {
        return 'canelaMessageReacted';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return DialogMessage::class;
    }

    #[\Override]
    public function getSubject(): AbstractModel
    {
        return $this->message;
    }

    #[\Override]
    public function getFromUser(): User
    {
        return $this->user;
    }

    #[\Override]
    public function getData(): mixed
    {
        return $this->reaction;
    }
}
