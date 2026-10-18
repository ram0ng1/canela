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

namespace Ramon\Canela\Bookmarks\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\Bookmarks\Bookmark;

/**
 * Marcadores são pessoais: só o dono vê, edita e apaga.
 *
 * `forceDeny` para os outros, e não `deny`: sem ele o Gate deixaria passar os
 * administradores, e nem eles leem os marcadores dos outros (no Discourse
 * também não).
 */
final class BookmarkPolicy extends AbstractPolicy
{
    public function view(User $actor, Bookmark $bookmark): string
    {
        return $this->ownerOnly($actor, $bookmark);
    }

    public function edit(User $actor, Bookmark $bookmark): string
    {
        return $this->ownerOnly($actor, $bookmark);
    }

    public function delete(User $actor, Bookmark $bookmark): string
    {
        return $this->ownerOnly($actor, $bookmark);
    }

    private function ownerOnly(User $actor, Bookmark $bookmark): string
    {
        return ! $actor->isGuest() && $bookmark->user_id === $actor->id ? $this->allow() : $this->forceDeny();
    }
}
