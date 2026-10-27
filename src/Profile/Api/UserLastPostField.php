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

namespace Ramon\Canela\Profile\Api;

use Flarum\Api\Context;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\Post\Post;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Carbon\Carbon;
use DateTimeInterface;

/**
 * A data da última postagem, para a linha de estatísticas do perfil
 * ("Última postagem 1 d").
 *
 * Vem com o próprio usuário, e não num segundo pedido do front depois que a
 * página abre (o valor aparecia atrasado). Só na resposta do perfil
 * (`GET /api/users/{id}`): numa lista seria uma consulta por pessoa.
 *
 * A mesma regra do pedido antigo (`/api/posts?filter[author]=…`): o último
 * comentário que quem está vendo pode ver (`whereVisibleTo`), sem os ocultos,
 * os privados e os de discussões que ele não enxerga.
 */
final class UserLastPostField
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    /** @return array<int, Schema\Attribute> */
    public function __invoke(): array
    {
        return [
            Schema\DateTime::make('canelaLastPostAt')
                ->visible(fn (User $user, Context $context) => $context->showing(UserResource::class)
                    && (bool) $this->settings->get('canela.user_stats', true))
                ->get(fn (User $user, Context $context) => $this->lastPostAt($user, $context->getActor())),
        ];
    }

    private function lastPostAt(User $user, User $actor): ?DateTimeInterface
    {
        if (! $user->comment_count) {
            return null;
        }

        $date = Post::whereVisibleTo($actor)
            ->where('posts.user_id', $user->id)
            ->where('posts.type', 'comment')
            ->latest('posts.created_at')
            ->value('posts.created_at');

        return $date ? Carbon::parse($date) : null;
    }
}
