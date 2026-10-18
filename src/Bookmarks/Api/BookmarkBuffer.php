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

namespace Ramon\Canela\Bookmarks\Api;

use Closure;
use Illuminate\Database\QueryException;
use Ramon\Canela\Bookmarks\Bookmark;

/**
 * Carrega em lote os marcadores do ator para os posts de uma resposta.
 *
 * Os posts chegam à API por muitos caminhos (a página do tópico, o post
 * incluído numa notificação, a busca…), e uma relação do Eloquent precisaria
 * de um eager load em cada endpoint para não virar N+1. O serializador do
 * Flarum adia valores que são closures e resolve um nível inteiro de uma vez:
 * cada post só anota o próprio id aqui, e a primeira closure resolvida busca
 * os marcadores de todos os anotados numa consulta só — o mesmo truque do
 * EloquentBuffer do core.
 */
final class BookmarkBuffer
{
    /** @var array<int, array<int, true>> ator => ids de posts à espera */
    private static array $pending = [];

    /** @var array<int, array<int, Bookmark|null>> ator => post => marcador (ou nenhum) */
    private static array $loaded = [];

    /**
     * @return Closure(): ?Bookmark
     */
    public static function defer(int $actorId, int $postId): Closure
    {
        if (! array_key_exists($postId, self::$loaded[$actorId] ?? [])) {
            self::$pending[$actorId][$postId] = true;
        }

        return static function () use ($actorId, $postId): ?Bookmark {
            self::resolve($actorId);

            return self::$loaded[$actorId][$postId] ?? null;
        };
    }

    /** Esquece um par já carregado, para a próxima leitura ir ao banco. */
    public static function forget(int $actorId, int $postId): void
    {
        unset(self::$loaded[$actorId][$postId]);
    }

    private static function resolve(int $actorId): void
    {
        $postIds = array_keys(self::$pending[$actorId] ?? []);

        if (! $postIds) {
            return;
        }

        unset(self::$pending[$actorId]);

        try {
            $found = Bookmark::query()
                ->where('user_id', $actorId)
                ->whereIn('post_id', $postIds)
                ->get()
                ->keyBy('post_id');
        } catch (QueryException $error) {
            // Tabela ainda não migrada (o tema atualizado antes do `migrate`):
            // os posts saem sem marcador em vez de derrubar a página do tópico.
            error_log('[ramon/canela] marcadores indisponíveis: '.$error->getMessage());
            $found = Bookmark::query()->getModel()->newCollection();
        }

        foreach ($postIds as $postId) {
            self::$loaded[$actorId][$postId] = $found->get($postId);
        }
    }
}
