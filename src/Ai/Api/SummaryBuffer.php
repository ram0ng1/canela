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

namespace Ramon\Canela\Ai\Api;

use Closure;
use Illuminate\Database\QueryException;
use Ramon\Canela\Ai\TopicSummary;

/**
 * Carrega em lote os resumos dos tópicos de uma resposta da API.
 *
 * A lista de tópicos traz 20 de uma vez; cada tópico anota o próprio id aqui,
 * e a primeira closure resolvida pelo serializador busca os resumos de todos
 * numa consulta só — o mesmo truque do BookmarkBuffer (e do EloquentBuffer do
 * core), sem precisar de eager load em cada endpoint.
 */
final class SummaryBuffer
{
    /** @var array<int, true> */
    private static array $pending = [];

    /** @var array<int, TopicSummary|null> */
    private static array $loaded = [];

    /**
     * @return Closure(): ?TopicSummary
     */
    public static function defer(int $discussionId): Closure
    {
        if (! array_key_exists($discussionId, self::$loaded)) {
            self::$pending[$discussionId] = true;
        }

        return static function () use ($discussionId): ?TopicSummary {
            self::resolve();

            return self::$loaded[$discussionId] ?? null;
        };
    }

    private static function resolve(): void
    {
        $ids = array_keys(self::$pending);

        if (! $ids) {
            return;
        }

        self::$pending = [];

        try {
            $found = TopicSummary::query()->whereIn('discussion_id', $ids)->get()->keyBy('discussion_id');
        } catch (QueryException $error) {
            // Tabela por criar: os tópicos saem sem resumo, a lista continua.
            error_log('[ramon/canela] resumos de IA indisponíveis: '.$error->getMessage());
            $found = collect();
        }

        foreach ($ids as $id) {
            self::$loaded[$id] = $found->get($id);
        }
    }
}
