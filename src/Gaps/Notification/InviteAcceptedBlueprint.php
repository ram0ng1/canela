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

namespace Ramon\Canela\Gaps\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;

/**
 * "Fulano aceitou seu convite". O
 * assunto e o remetente são a pessoa que entrou: é o perfil dela que abre.
 */
final class InviteAcceptedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly User $newUser,
    ) {
    }

    #[\Override]
    public function getSubject(): ?AbstractModel
    {
        return $this->newUser;
    }

    #[\Override]
    public function getFromUser(): ?User
    {
        return $this->newUser;
    }

    #[\Override]
    public function getData(): mixed
    {
        return null;
    }

    #[\Override]
    public static function getType(): string
    {
        return 'canelaInviteAccepted';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return User::class;
    }
}
