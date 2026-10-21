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

/**
 * A regra de visualização, num lugar só para os tópicos e as mensagens
 * privadas contarem igual.
 *
 * Pense numa chave `view:<tópico>:<dia>:<user|ip>` com validade de 8 h: só
 * conta quando a chave ainda não existe. Daí as duas travas juntas:
 *
 * - **o dia**: a chave leva a data, então um dia novo sempre conta de novo —
 *   mesmo que a última visualização tenha sido às 23h59;
 * - **as horas**: dentro do mesmo dia, a chave vence depois de N horas, e
 *   quem continua no tópico (ou volta à tarde) conta outra vez.
 *
 * Guardando a hora da última visualização contada, as duas travas viram uma
 * comparação: a trava está de pé só se a última contagem foi HOJE e há menos
 * de N horas — exatamente quando a chave ainda existiria.
 */
final class ViewRule
{
    /** Horas até a mesma pessoa contar de novo. */
    public const DEFAULT_DURATION_HOURS = 8;

    public static function countsAgain(?CarbonInterface $lastCountedAt, CarbonInterface $now, int $durationHours): bool
    {
        if ($lastCountedAt === null) {
            return true;
        }

        if ($lastCountedAt->toDateString() !== $now->toDateString()) {
            return true;
        }

        return $lastCountedAt->lessThanOrEqualTo($now->copy()->subHours($durationHours));
    }

    /**
     * A chave da trava, para quem a guarda no cache (as mensagens
     * fazem assim): com a data dentro, a validade de N horas reproduz as duas
     * travas sem precisar ler nada antes — basta um `Cache::add($key, 1, N h)`.
     */
    public static function cacheKey(string $kind, int $id, CarbonInterface $now, string $identity): string
    {
        return sprintf('canela.view.%s.%d.%s.%s', $kind, $id, $now->toDateString(), $identity);
    }
}
