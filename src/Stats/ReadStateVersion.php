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

use Illuminate\Contracts\Cache\Repository as Cache;

/**
 * Uma "versão" do que cada pessoa leu, guardada no cache: as contagens de
 * novos e não lidos e o ponto das categorias entram no cache com ela na
 * chave, e ler um tópico, marcar tudo como lido ou postar troca a versão —
 * as contas antigas deixam de valer na hora, sem apagar chave por chave.
 */
final class ReadStateVersion
{
    private const TTL = 86400;

    public function __construct(
        private readonly Cache $cache,
    ) {
    }

    public function get(int $userId): string
    {
        return (string) ($this->cache->get(self::key($userId)) ?? '0');
    }

    public function bump(int $userId): void
    {
        if ($userId > 0) {
            $this->cache->put(self::key($userId), bin2hex(random_bytes(6)), self::TTL);
        }
    }

    private static function key(int $userId): string
    {
        return 'canela.reads.v.'.$userId;
    }
}
