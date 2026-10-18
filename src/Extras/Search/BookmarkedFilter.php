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
use Ramon\Canela\Support\SchemaCache;

/**
 * `filter[canelaBookmarked]`: o "marcados por mim" do Discourse — tópicos com
 * uma postagem que eu marquei (na busca de tópicos) ou as próprias postagens
 * marcadas (na de postagens).
 *
 * Os marcadores são outro recurso do tema (tabela `canela_bookmarks`), que pode
 * estar desligado ou ainda sem a migração: sem a tabela o filtro simplesmente
 * não acha nada, em vez de derrubar a busca.
 *
 * Sempre o próprio ator: os marcadores são privados.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class BookmarkedFilter implements FilterInterface
{
    public const KEY = 'canelaBookmarked';

    private const TABLE = 'canela_bookmarks';

    public function __construct(
        /** Coluna com o id da postagem (`posts.id`) ou do tópico (`discussions.id`). */
        private readonly string $scope = 'discussions',
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return self::KEY;
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();
        $query = $state->getQuery();

        if ($actor->isGuest() || ! $this->tableExists($state)) {
            if (! $negate) {
                $query->whereRaw('1 = 0');
            }

            return;
        }

        $scope = $this->scope;

        $bookmarked = static function (Builder $sub) use ($actor, $scope): void {
            $sub->selectRaw('1')->from(self::TABLE)->where(self::TABLE.'.user_id', $actor->id);

            if ($scope === 'posts') {
                $sub->whereColumn(self::TABLE.'.post_id', 'posts.id');
            } else {
                $sub->join('posts as canela_bookmarked_posts', 'canela_bookmarked_posts.id', '=', self::TABLE.'.post_id')
                    ->whereColumn('canela_bookmarked_posts.discussion_id', 'discussions.id');
            }
        };

        if ($negate) {
            $query->whereNotExists($bookmarked);
        } else {
            $query->whereExists($bookmarked);
        }
    }

    private function tableExists(SearchState $state): bool
    {
        static $exists = null;

        return $exists ??= resolve(SchemaCache::class)->hasTable(self::TABLE);
    }
}
