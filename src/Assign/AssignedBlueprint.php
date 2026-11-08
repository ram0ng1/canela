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

namespace Ramon\Canela\Assign;

use Flarum\Database\AbstractModel;
use Flarum\Discussion\Discussion;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;

/** "Fulano atribuiu o tópico X a você." */
final class AssignedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly Discussion $discussion,
        public readonly User $actor,
    ) {
    }

    #[\Override]
    public function getSubject(): AbstractModel
    {
        return $this->discussion;
    }

    #[\Override]
    public function getFromUser(): User
    {
        return $this->actor;
    }

    #[\Override]
    public function getData(): mixed
    {
        return null;
    }

    #[\Override]
    public static function getType(): string
    {
        return 'canelaAssigned';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return Discussion::class;
    }
}
