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
use Flarum\Search\ValidateFilterTrait;

/**
 * `filter[canelaMinPosts]=N`: tópicos com pelo menos N postagens, o "mínimo de
 * postagens" dos filtros avançados.
 *
 * Conta pelo `comment_count`, a coluna que o core já mantém: a postagem de
 * abertura entra na conta.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class MinPostsFilter implements FilterInterface
{
    use ValidateFilterTrait;

    #[\Override]
    public function getFilterKey(): string
    {
        return 'canelaMinPosts';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $minimum = max(0, $this->asInt($value));

        // Negado vira "menos de N", o complemento exato do filtro.
        $state->getQuery()->where('discussions.comment_count', $negate ? '<' : '>=', $minimum);
    }
}
