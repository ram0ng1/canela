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

namespace Ramon\Canela\Stats;

use Carbon\CarbonInterface;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Support\SchemaCache;
use Throwable;

/**
 * As visualizações por dia de cada tópico (o TopicViewStat do Discourse), que
 * alimentam o gráfico "Visualizações recentes" do mapa do tópico.
 *
 * Anônimos e logados ficam em colunas separadas, como lá: o gráfico soma as
 * duas, mas o número dividido é o que um relatório futuro vai querer.
 */
final class TopicViewStats
{
    public const TABLE = 'canela_topic_view_stats';

    /**
     * Se a tabela existe, lido uma vez por processo. A migração pode ainda não
     * ter rodado: sem a tabela, a visualização continua sendo contada no
     * tópico, só não entra no gráfico.
     */
    private ?bool $available = null;

    public function __construct(
        private readonly ConnectionInterface $db
    ) {
    }

    public function available(): bool
    {
        if ($this->available === null) {
            try {
                $this->available = resolve(SchemaCache::class)->hasTable(self::TABLE);
            } catch (Throwable) {
                $this->available = false;
            }
        }

        return $this->available;
    }

    /**
     * Soma uma visualização no dia, num comando só (INSERT … ON DUPLICATE KEY
     * UPDATE, o ON CONFLICT do Discourse): duas visualizações simultâneas no
     * mesmo dia não podem uma apagar a outra.
     */
    public function add(int $discussionId, CarbonInterface $date, bool $loggedIn): void
    {
        if (! $this->available()) {
            return;
        }

        $anonymous = $loggedIn ? 0 : 1;
        $logged = $loggedIn ? 1 : 0;

        $this->db->table(self::TABLE)->upsert(
            [[
                'discussion_id' => $discussionId,
                'date' => $date->toDateString(),
                'anonymous_views' => $anonymous,
                'logged_in_views' => $logged,
            ]],
            ['discussion_id', 'date'],
            // Coluna com a tabela: no `ON CONFLICT DO UPDATE` do PostgreSQL um
            // nome solto é ambíguo (a tabela ou `excluded`).
            [
                'anonymous_views' => $this->db->raw($this->db->getQueryGrammar()->wrap(self::TABLE.'.anonymous_views').' + '.$anonymous),
                'logged_in_views' => $this->db->raw($this->db->getQueryGrammar()->wrap(self::TABLE.'.logged_in_views').' + '.$logged),
            ]
        );
    }

    /**
     * Os dias com visualização entre `$from` e `$to` (inclusive), em ordem,
     * no formato da rota `/t/{id}/view-stats.json` do Discourse:
     * `[{viewed_at: 'AAAA-MM-DD', views: N}]`. Dias sem nada não vêm — o
     * gráfico preenche os buracos com zero.
     *
     * @return list<array{viewed_at: string, views: int}>
     */
    public function forDiscussion(int $discussionId, CarbonInterface $from, CarbonInterface $to): array
    {
        if (! $this->available()) {
            return [];
        }

        return $this->db->table(self::TABLE)
            ->where('discussion_id', $discussionId)
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('date')
            ->get(['date', 'anonymous_views', 'logged_in_views'])
            ->map(static fn (object $row): array => [
                'viewed_at' => substr((string) $row->date, 0, 10),
                'views' => (int) $row->anonymous_views + (int) $row->logged_in_views,
            ])
            ->values()
            ->all();
    }
}
