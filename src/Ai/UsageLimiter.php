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

namespace Ramon\Canela\Ai;

use Carbon\Carbon;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;

/**
 * O limite diário de pedidos à IA por pessoa (`canela.ai_daily_limit`; 0 =
 * sem limite).
 *
 * Cada pedido conta na hora em que começa — uma resposta em andamento já
 * gastou —, e os tokens entram quando ela termina. Administradores não têm
 * limite: são eles que pagam a conta e testam o recurso.
 */
final class UsageLimiter
{
    public function __construct(
        private readonly AiSettings $settings,
        private readonly ConnectionInterface $db,
    ) {
    }

    /** Pedidos que ainda restam hoje, ou null quando não há limite. */
    public function remaining(User $actor): ?int
    {
        $limit = $this->settings->int(AiSettings::DAILY_LIMIT, 0);

        if ($limit === 0 || $actor->isAdmin()) {
            return null;
        }

        $used = (int) $this->db->table('canela_ai_usage')
            ->where('user_id', $actor->id)
            ->where('day', $this->today())
            ->value('requests');

        return max(0, $limit - $used);
    }

    public function exhausted(User $actor): bool
    {
        $remaining = $this->remaining($actor);

        return $remaining !== null && $remaining <= 0;
    }

    /**
     * Confere e gasta um pedido de uma vez só: o UPDATE condicional é atômico,
     * então pedidos em paralelo não passam juntos do limite. Devolve false
     * quando o limite de hoje já acabou.
     */
    public function claim(User $actor): bool
    {
        $limit = $this->settings->int(AiSettings::DAILY_LIMIT, 0);

        if ($limit === 0 || $actor->isAdmin()) {
            $this->countRequest($actor);

            return true;
        }

        $this->db->table('canela_ai_usage')->insertOrIgnore([
            'user_id' => $actor->id, 'day' => $this->today(), 'requests' => 0, 'input_tokens' => 0, 'output_tokens' => 0,
        ]);

        $query = $this->db->table('canela_ai_usage');

        return $query
            ->where('user_id', $actor->id)
            ->where('day', $this->today())
            ->where('requests', '<', $limit)
            ->update(['requests' => $this->db->raw($query->getGrammar()->wrap('requests').' + 1')]) > 0;
    }

    public function countRequest(User $actor): void
    {
        $query = $this->db->table('canela_ai_usage');

        $query->upsert(
            [['user_id' => $actor->id, 'day' => $this->today(), 'requests' => 1, 'input_tokens' => 0, 'output_tokens' => 0]],
            ['user_id', 'day'],
            // Coluna com a tabela: no `ON CONFLICT DO UPDATE` do PostgreSQL um
            // nome solto é ambíguo (a tabela ou `excluded`).
            ['requests' => $this->db->raw($query->getGrammar()->wrap('canela_ai_usage.requests').' + 1')]
        );
    }

    public function addTokens(User $actor, int $input, int $output): void
    {
        if ($input <= 0 && $output <= 0) {
            return;
        }

        $this->db->table('canela_ai_usage')
            ->where('user_id', $actor->id)
            ->where('day', $this->today())
            ->update([
                'input_tokens' => $this->db->raw('input_tokens + '.max(0, $input)),
                'output_tokens' => $this->db->raw('output_tokens + '.max(0, $output)),
            ]);
    }

    private function today(): string
    {
        return Carbon::now()->toDateString();
    }
}
