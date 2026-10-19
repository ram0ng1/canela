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

namespace Ramon\Canela\System;

use Flarum\Messages\Dialog;
use Flarum\User\User;

/** A conversa tem o usuário do sistema (e quem olha não é ele)? */
final class SystemDialogs
{
    public static function involvesSystem(Dialog $dialog, User $actor): bool
    {
        $system = resolve(SystemUser::class);
        $id = $system->id();

        if (! $id || $system->is($actor)) {
            return false;
        }

        if ($dialog->relationLoaded('users')) {
            return $dialog->users->contains('id', $id);
        }

        return $dialog->users()->where('users.id', $id)->exists();
    }
}
