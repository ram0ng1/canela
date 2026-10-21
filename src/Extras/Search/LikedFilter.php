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

namespace Ramon\Canela\Extras\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Illuminate\Database\Query\Builder;

/**
 * `filter[canelaLiked]`: tópicos em que quem pesquisa curtiu alguma postagem
 * ("curtidos por mim").
 *
 * O flarum/likes só filtra POSTAGENS por quem curtiu (`likedBy`); na busca de
 * tópicos o equivalente é "tem uma postagem curtida por mim". O valor é
 * ignorado e vale sempre o próprio ator: as curtidas alheias agrupadas por
 * tópico não são públicas, e o filtro não pode virar um jeito de descobri-las.
 *
 * Só é registrado com o flarum/likes ligado (a tabela é dele).
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class LikedFilter implements FilterInterface
{
    #[\Override]
    public function getFilterKey(): string
    {
        return 'canelaLiked';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();
        $query = $state->getQuery();

        if ($actor->isGuest()) {
            // Visitante não curte nada: "curtidos por mim" não acha nada, e o
            // filtro negado não restringe nada.
            if (! $negate) {
                $query->whereRaw('1 = 0');
            }

            return;
        }

        $likedByActor = static function (Builder $sub) use ($actor): void {
            $sub->selectRaw('1')
                ->from('post_likes')
                ->join('posts as canela_liked_posts', 'canela_liked_posts.id', '=', 'post_likes.post_id')
                ->whereColumn('canela_liked_posts.discussion_id', 'discussions.id')
                ->where('post_likes.user_id', $actor->id);
        };

        if ($negate) {
            $query->whereNotExists($likedByActor);
        } else {
            $query->whereExists($likedByActor);
        }
    }
}
