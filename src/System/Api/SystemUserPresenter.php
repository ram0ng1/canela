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

namespace Ramon\Canela\System\Api;

use Flarum\Http\SlugManager;
use Flarum\User\User;

/**
 * O resumo do usuário do sistema que o fórum e o admin recebem
 * (`canelaSystemUser`): o bastante para o card do admin mostrar quem é e
 * levar ao perfil, onde se trocam o avatar e a bio.
 */
final class SystemUserPresenter
{
    public function __construct(
        private readonly SlugManager $slugs,
    ) {
    }

    /** @return array{id: int, username: string, displayName: string, avatarUrl: ?string, slug: string} */
    public function present(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'username' => (string) $user->username,
            'displayName' => (string) $user->display_name,
            'avatarUrl' => $user->avatar_url,
            'slug' => $this->slugs->forResource(User::class)->toSlug($user),
        ];
    }
}
