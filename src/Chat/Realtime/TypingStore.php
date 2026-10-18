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

namespace Ramon\Canela\Chat\Realtime;

use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Quem está digitando em cada canal, no cache do Flarum, para o modo sem
 * websocket: o polling devolve a lista junto com as mensagens novas.
 *
 * Cada aviso vale alguns segundos — o front repete enquanto a pessoa digita —,
 * então quem fecha a aba no meio da frase some sozinho da lista.
 */
final class TypingStore
{
    private const TTL_SECONDS = 8;

    public function __construct(
        private readonly Cache $cache,
    ) {
    }

    public function set(int $channelId, ?int $threadId, int $userId, bool $typing): void
    {
        $key = $this->key($channelId);
        $now = time();

        $entries = array_filter((array) $this->cache->get($key, []), static fn ($entry) => is_array($entry) && ($entry['until'] ?? 0) > $now);

        if ($typing) {
            $entries[$userId] = ['thread' => $threadId, 'until' => $now + self::TTL_SECONDS];
        } else {
            unset($entries[$userId]);
        }

        $this->cache->put($key, $entries, self::TTL_SECONDS * 2);
    }

    /** @return int[] */
    public function get(int $channelId, ?int $threadId, ?int $except = null): array
    {
        $now = time();
        $ids = [];

        foreach ((array) $this->cache->get($this->key($channelId), []) as $userId => $entry) {
            if (is_array($entry) && ($entry['until'] ?? 0) > $now && ($entry['thread'] ?? null) === $threadId && (int) $userId !== $except) {
                $ids[] = (int) $userId;
            }
        }

        return $ids;
    }

    private function key(int $channelId): string
    {
        return 'canela.chat.typing.'.$channelId;
    }
}
