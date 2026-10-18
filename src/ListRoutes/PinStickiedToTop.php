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

namespace Ramon\Canela\ListRoutes;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\SearchCriteria;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\Tags\Search\Filter\TagFilter;

/**
 * Fixados no topo da página inicial e da página da tag, em ordem de criação.
 *
 * O flarum/sticky só fixa quando a ordenação é a padrão (sem `sort` na
 * requisição), mas a aba "Recentes" do tema pede `-lastPostedAt` explícito:
 * os fixados se perdiam no meio da lista. Aqui, na lista sem busca, sem
 * filtro (ou só com a tag) e ordenada por atividade, os fixados sobem, e
 * entre eles vale a ordem em que foram criados (o primeiro fixado criado
 * fica em cima), em vez da última atividade.
 */
final class PinStickiedToTop
{
    public function __construct(private readonly SettingsRepositoryInterface $settings)
    {
    }

    public function __invoke(DatabaseSearchState $state, SearchCriteria $criteria): void
    {
        if ($state->isFulltextSearch() || ! $this->sortsByActivity($criteria)) {
            return;
        }

        $filters = $state->getActiveFilters();
        $onTag = count($filters) === 1 && $filters[0] instanceof TagFilter;

        if ($filters !== [] && ! $onTag) {
            return;
        }

        if (! $onTag) {
            // Na página inicial, respeita o "não fixar aqui" do flarum/sticky.
            if (! $this->settings->get('flarum-sticky.pin_sticky_on_all_discussions', true)) {
                return;
            }

            // Na ordenação padrão com "só os não lidos", o próprio flarum/sticky
            // monta uma união e reordena: mexer nas ordens aqui a quebraria.
            if ($criteria->sortIsDefault && $this->settings->get('flarum-sticky.only_sticky_unread_discussions')) {
                return;
            }
        }

        $query = $state->getQuery()->getQuery();
        $orders = array_values(array_filter(
            is_array($query->orders) ? $query->orders : [],
            static fn (array $order): bool => ($order['column'] ?? null) !== 'is_sticky'
        ));

        $query->orders = [
            ['column' => 'is_sticky', 'direction' => 'desc'],
            // Só os fixados ganham a data de criação; os demais empatam (NULL)
            // e seguem a ordenação pedida.
            ['type' => 'Raw', 'sql' => 'CASE WHEN discussions.is_sticky = 1 THEN discussions.created_at END ASC'],
            ...$orders,
        ];
    }

    private function sortsByActivity(SearchCriteria $criteria): bool
    {
        return $criteria->sortIsDefault || $criteria->sort === ['lastPostedAt' => 'desc'];
    }
}
