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

namespace Ramon\Canela\Community;

use Flarum\Group\Group;
use Flarum\Http\SlugManager;
use Flarum\User\User;

/**
 * Transforma usuários em objetos de recurso do JSON:API (`type: users`) com
 * só o que as páginas de comunidade mostram.
 *
 * Os endpoints do tema não passam pelo UserResource — o /api/users exige a
 * permissão de busca, que o "Sobre" não pode exigir —, mas devolver o mesmo
 * formato deixa o fórum pôr esses usuários no store (`pushObject`) e usar o
 * Avatar, o `username()` e as rotas de perfil do core sem adaptação.
 *
 * As regras de visibilidade são as do UserResource: `lastSeenAt` só quando o
 * usuário divulga que está online ou o ator pode ver, e grupos ocultos só para
 * quem pode vê-los.
 */
final class UserPresenter
{
    public function __construct(
        private readonly SlugManager $slugManager
    ) {
    }

    /**
     * @param iterable<User> $users
     * @return list<array<string, mixed>>
     */
    public function many(iterable $users, User $actor): array
    {
        $resources = [];

        foreach ($users as $user) {
            $resources[] = $this->one($user, $actor);
        }

        return $resources;
    }

    /** @return array<string, mixed> */
    public function one(User $user, User $actor): array
    {
        $groups = $user->groups;

        if (! $actor->can('viewHiddenGroups')) {
            $groups = $groups->filter(fn (Group $group) => ! $group->is_hidden);
        }

        $attributes = [
            'username' => $user->username,
            'displayName' => $user->display_name,
            'avatarUrl' => $user->avatar_url,
            'slug' => $this->slugManager->forResource(User::class)->toSlug($user),
            'joinTime' => $user->joined_at?->toAtomString(),
            'discussionCount' => (int) $user->discussion_count,
            'commentCount' => (int) $user->comment_count,
        ];

        if ($user->getPreference('discloseOnline') || $actor->can('viewLastSeenAt', $user)) {
            $attributes['lastSeenAt'] = $user->last_seen_at?->toAtomString();
        }

        return [
            'type' => 'users',
            'id' => (string) $user->id,
            'attributes' => $attributes,
            'relationships' => [
                'groups' => [
                    'data' => $groups->values()->map(fn (Group $group) => ['type' => 'groups', 'id' => (string) $group->id])->all(),
                ],
            ],
        ];
    }
}
