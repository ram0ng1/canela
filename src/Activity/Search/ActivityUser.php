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

namespace Ramon\Canela\Activity\Search;

use Flarum\Http\SlugManager;
use Flarum\User\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * A pessoa dona da aba: os filtros recebem o slug do perfil (como o `author`
 * do core), que pode ser o nome ou o id, conforme o driver de slug.
 */
final class ActivityUser
{
    public function __construct(
        private readonly SlugManager $slugManager
    ) {
    }

    /** @param string|array<mixed> $value */
    public function resolve(string|array $value, User $actor): ?User
    {
        $slug = trim(is_array($value) ? (string) (reset($value) ?: '') : $value);

        if ($slug === '') {
            return null;
        }

        try {
            $user = $this->slugManager->forResource(User::class)->fromSlug($slug, $actor);
        } catch (ModelNotFoundException) {
            return null;
        }

        return $user instanceof User ? $user : null;
    }

    /** O que é pessoal (Lidos): só a própria pessoa e quem administra. */
    public static function canSeePrivate(User $actor, User $user): bool
    {
        return ! $actor->isGuest() && ($actor->id === $user->id || $actor->isAdmin());
    }
}
