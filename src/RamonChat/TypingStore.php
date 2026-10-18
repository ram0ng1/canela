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

namespace Ramon\Canela\RamonChat;

use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * "Está digitando" sem websocket: quem digita fica alguns segundos no cache,
 * por canal, e quem está com o canal aberto pergunta de tempos em tempos.
 *
 * O ramon/chat só avisa pelo flarum/realtime; sem ele o aviso se perdia.
 * Um item por canal (e não por pessoa) para a leitura ser um `get` só.
 */
final class TypingStore
{
    /** Quanto tempo o aviso vale sem um novo sinal (o cliente reenvia a cada 3 s). */
    public const TTL = 6;

    public function __construct(
        private readonly Cache $cache,
    ) {
    }

    public function touch(int $channelId, int $userId, string $username, bool $typing): void
    {
        $entries = $this->fresh($channelId);

        if ($typing) {
            $entries[$userId] = ['username' => $username, 'until' => time() + self::TTL];
        } else {
            unset($entries[$userId]);
        }

        if ($entries === []) {
            $this->cache->forget($this->key($channelId));

            return;
        }

        $this->cache->put($this->key($channelId), $entries, self::TTL + 2);
    }

    /**
     * Quem está digitando agora, menos quem pergunta.
     *
     * @return list<array{userId: int, username: string}>
     */
    public function typists(int $channelId, int $exceptUserId): array
    {
        $out = [];

        foreach ($this->fresh($channelId) as $userId => $entry) {
            if ((int) $userId === $exceptUserId) {
                continue;
            }

            $out[] = ['userId' => (int) $userId, 'username' => (string) $entry['username']];
        }

        return $out;
    }

    /** @return array<int, array{username: string, until: int}> */
    private function fresh(int $channelId): array
    {
        $entries = $this->cache->get($this->key($channelId));

        if (! is_array($entries)) {
            return [];
        }

        $now = time();

        return array_filter($entries, static fn ($entry): bool => is_array($entry) && (int) ($entry['until'] ?? 0) > $now);
    }

    private function key(int $channelId): string
    {
        return 'canela.ramonchat.typing.'.$channelId;
    }
}
