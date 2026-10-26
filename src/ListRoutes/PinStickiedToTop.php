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

use Carbon\Carbon;
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
 *
 * Sem expressão no ORDER BY da tabela toda: um `CASE` ali impede o banco de
 * usar índice, e cada lista ordenaria todos os tópicos visíveis antes do
 * LIMIT. A consulta vira a união de duas partes, cada uma no índice do
 * flarum/sticky: todos os tópicos por `is_sticky, last_posted_at` e só os
 * fixados por `is_sticky, created_at`, cada uma cortada em offset + limite.
 * A ordem final (pela data de criação dos fixados) só reordena essas poucas
 * linhas. É o mesmo
 * truque do flarum/sticky na lista de não lidos.
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

            // "Fixar só os não lidos" (flarum-sticky.only_sticky_unread_discussions)
            // vale na inicial em qualquer ordenação por atividade. Na padrão, o
            // próprio flarum/sticky monta a união dele (mexer aqui a quebraria);
            // na "Recentes" (`-lastPostedAt` explícito) ele não roda, e a mesma
            // regra é aplicada aqui — senão os fixados já lidos subiriam.
            if ($this->settings->get('flarum-sticky.only_sticky_unread_discussions')) {
                if (! $criteria->sortIsDefault) {
                    $this->pinUnreadStickiedToTop($state);
                }

                return;
            }
        }

        $query = $state->getQuery()->getQuery();
        $orders = array_values(array_filter(
            is_array($query->orders) ? $query->orders : [],
            static fn (array $order): bool => ($order['column'] ?? null) !== 'is_sticky'
        ));

        // Pela gramática (o prefixo das tabelas) e com TRUE, não 1: no
        // PostgreSQL `is_sticky` é boolean, e boolean = inteiro não existe.
        $grammar = $query->getGrammar();

        // Uma ordenação crua (com bindings) ou sem limite não cabe na união:
        // fica a ordem com o CASE direto, que dá o mesmo resultado.
        $raw = array_filter($orders, static fn (array $order): bool => ! isset($order['column'], $order['direction']));

        if ($raw !== [] || $query->limit === null || $query->unions) {
            $query->orders = [
                ['column' => 'is_sticky', 'direction' => 'desc'],
                // Só os fixados ganham a data de criação; os demais empatam (NULL)
                // e seguem a ordenação pedida.
                ['type' => 'Raw', 'sql' => 'CASE WHEN '.$grammar->wrap('discussions.is_sticky').' = TRUE THEN '.$grammar->wrap('discussions.created_at').' END ASC'],
                ...$orders,
            ];

            return;
        }

        // O desempate pela chave, na direção da última ordem (como o
        // AbstractSearcher faz): sem ele, o corte de cada parte poderia
        // escolher outra linha entre empatadas.
        $direction = 'asc';

        foreach (array_reverse($orders) as $order) {
            $direction = $order['direction'];
            break;
        }

        $tie = ['column' => 'discussions.id', 'direction' => $direction];

        // A ordem de uma união só pode citar colunas do resultado (o SQLite
        // recusa expressões ali): a data de criação dos fixados vira uma coluna.
        if (! $query->columns) {
            $query->select('discussions.*');
        }

        $query->selectRaw('CASE WHEN '.$grammar->wrap('discussions.is_sticky').' = TRUE THEN '.$grammar->wrap('discussions.created_at').' END AS canela_pin_order');

        $sticky = clone $query;
        $sticky->where('discussions.is_sticky', true);
        $sticky->orders = [['column' => 'discussions.created_at', 'direction' => 'asc'], ...$orders, $tie];

        $query->orders = [['column' => 'discussions.is_sticky', 'direction' => 'desc'], ...$orders, $tie];

        // A ordem da união vale sobre as colunas do resultado: sem o nome da tabela.
        $bare = static fn (array $order): array => ['column' => (string) preg_replace('/^.*\./', '', (string) $order['column']), 'direction' => $order['direction']];

        $query->union($sticky);
        $query->unionOrders = [
            ['column' => 'is_sticky', 'direction' => 'desc'],
            ['column' => 'canela_pin_order', 'direction' => 'asc'],
            ...array_map($bare, $orders),
        ];
        $query->unionLimit = $query->limit;
        $query->unionOffset = $query->offset;

        // Cada parte traz o bastante para a página pedida; a união corta depois.
        $query->limit = $sticky->limit = (int) $query->offset + (int) $query->limit;
        $query->offset = $sticky->offset = null;
    }

    /**
     * O que o flarum/sticky faz na ordenação padrão com "só os não lidos"
     * (PinStickiedDiscussionsToTop): os fixados que o ator ainda não leu sobem,
     * os já lidos ficam no lugar da atividade. Uma união com só os fixados,
     * para a marcação `is_unread_sticky` não custar uma ordenação da tabela.
     */
    private function pinUnreadStickiedToTop(DatabaseSearchState $state): void
    {
        $query = $state->getQuery()->getQuery();
        $actor = $state->getActor();

        if ($query->unions) {
            return;
        }

        if (! $query->columns) {
            $query->select('discussions.*');
        }

        $sticky = clone $query;
        $sticky->where('discussions.is_sticky', true);
        $sticky->orders = null;

        $grammar = $query->getGrammar();
        $markedAllAsReadAt = $actor->marked_all_as_read_at ?: Carbon::createFromTimestamp(0);

        foreach ([$sticky, $query] as $q) {
            $read = $q->newQuery()
                ->selectRaw('1')
                ->from('discussion_user as sticky')
                ->whereColumn('sticky.discussion_id', 'discussions.id')
                ->where('sticky.user_id', '=', $actor->id)
                ->whereColumn('sticky.last_read_post_number', '>=', 'discussions.last_post_number');

            // Os bindings à mão, na ordem do SQL (como o flarum/sticky faz).
            $q->selectRaw(
                '('.$grammar->wrap('discussions.is_sticky').' = TRUE and not exists ('.$read->toSql().') and '.$grammar->wrap('discussions.last_posted_at').' > ?) as is_unread_sticky',
                [...$read->getBindings(), $markedAllAsReadAt->format('Y-m-d H:i:s')]
            );
        }

        $orders = is_array($query->orders) ? $query->orders : [];

        $query->union($sticky);
        // A ordem da união vale sobre as colunas do resultado: sem o nome da tabela.
        $query->unionOrders = [
            ['column' => 'is_unread_sticky', 'direction' => 'desc'],
            ...array_map(static fn (array $order): array => isset($order['column'])
                ? ['column' => (string) preg_replace('/^.*\./', '', (string) $order['column']), 'direction' => $order['direction']]
                : $order, $orders),
        ];
        $query->unionLimit = $query->limit;
        $query->unionOffset = $query->offset;

        $query->limit = $sticky->limit = $query->limit === null ? null : (int) $query->offset + (int) $query->limit;
        $query->offset = $sticky->offset = null;
    }

    private function sortsByActivity(SearchCriteria $criteria): bool
    {
        return $criteria->sortIsDefault || $criteria->sort === ['lastPostedAt' => 'desc'];
    }
}
