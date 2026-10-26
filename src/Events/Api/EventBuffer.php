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

namespace Ramon\Canela\Events\Api;

use Closure;
use Illuminate\Database\QueryException;
use Ramon\Canela\Events\CalendarEvent;

/**
 * Os eventos das primeiras postagens de uma resposta, numa consulta só: cada
 * postagem anota o próprio id, e a primeira closure resolvida busca todos (o
 * mesmo truque do SummaryBuffer). Sem isso, uma lista de postagens (perfil,
 * busca) fazia uma consulta por primeira postagem.
 */
final class EventBuffer
{
    /** @var array<int, true> */
    private static array $pending = [];

    /** @var array<int, CalendarEvent|null> */
    private static array $loaded = [];

    /** @return Closure(): ?CalendarEvent */
    public static function defer(int $postId): Closure
    {
        if (! array_key_exists($postId, self::$loaded)) {
            self::$pending[$postId] = true;
        }

        return static function () use ($postId): ?CalendarEvent {
            self::resolve();

            return self::$loaded[$postId] ?? null;
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
            $found = CalendarEvent::query()->with('user')->whereIn('post_id', $ids)->get()->keyBy('post_id');
        } catch (QueryException $error) {
            // Tabela por criar: as postagens saem sem evento.
            error_log('[ramon/canela] eventos indisponíveis: '.$error->getMessage());
            $found = collect();
        }

        foreach ($ids as $id) {
            $event = $found->get($id);
            self::$loaded[$id] = $event instanceof CalendarEvent ? $event : null;
        }
    }

    /** Esquece o que já foi carregado (depois de gravar um evento). */
    public static function flush(): void
    {
        self::$pending = [];
        self::$loaded = [];
    }
}
