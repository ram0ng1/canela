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

namespace Ramon\Canela\Badges\Listener;

use Flarum\User\Event\AvatarChanged;
use Flarum\User\Event\Saving;
use Flarum\User\User;
use Ramon\Canela\Badges\BadgeQueries;
use Ramon\Canela\Badges\Scope;

/**
 * Perfil alterado (bio, avatar): o Autobiógrafo. No `Saving` a bio ainda não
 * foi gravada — daí o `afterSave`.
 */
final class UserListener
{
    public function __construct(
        private readonly BadgeEvents $events,
    ) {
    }

    public function saving(Saving $event): void
    {
        $user = $event->user;

        if ($user->exists) {
            $user->afterSave(fn (User $saved) => $this->grant($saved));
        }
    }

    public function avatarChanged(AvatarChanged $event): void
    {
        $this->grant($event->user);
    }

    private function grant(User $user): void
    {
        $this->events->grant(BadgeQueries::TRIGGER_USER, Scope::users([$user->id]));
    }
}
