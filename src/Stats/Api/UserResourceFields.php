<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Api;

use Flarum\Api\Context;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\User\User;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\UserActivity;

/**
 * As estatísticas de atividade no usuário, só na resposta do perfil (Show).
 *
 * Numa listagem — os autores de cada tópico da página inicial, por exemplo —
 * elas custariam quatro consultas por pessoa para números que ninguém vê ali.
 * A UserPage do core sempre completa o usuário pelo Show ao abrir o perfil,
 * então os números chegam mesmo quando a pessoa já estava na memória.
 */
final class UserResourceFields
{
    /** atributo da API => chave do resumo em UserActivity */
    public const ATTRIBUTES = [
        'canelaDaysVisited' => 'daysVisited',
        'canelaTimeRead' => 'timeRead',
        'canelaRecentTimeRead' => 'recentTimeRead',
        'canelaPostsRead' => 'postsRead',
        'canelaTopicsViewed' => 'topicsViewed',
        'canelaLikesGiven' => 'likesGiven',
        'canelaLikesReceived' => 'likesReceived',
    ];

    public function __construct(
        private readonly StatsSettings $settings,
        private readonly UserActivity $activity
    ) {
    }

    public function __invoke(): array
    {
        $visible = fn (User $user, Context $context): bool => $this->settings->activityEnabled() && $context->showing(UserResource::class);

        $fields = [];

        foreach (self::ATTRIBUTES as $attribute => $stat) {
            $fields[] = Schema\Integer::make($attribute)
                ->nullable()
                ->visible($visible)
                ->get(fn (User $user) => $this->activity->get($user, $stat));
        }

        return $fields;
    }
}
