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

namespace Ramon\Canela\Support;

/**
 * Datas para a resposta da API, aceitando null: uma linha gravada sem o
 * timestamp (import, SQL direto) não derruba a resposta. Como o
 * `formatDate()` dos serializers do core.
 */
final class Dates
{
    public static function atom(?\DateTimeInterface $date): ?string
    {
        return $date?->format(\DateTimeInterface::ATOM);
    }

    public static function day(?\DateTimeInterface $date): string
    {
        return $date?->format('Y-m-d') ?? '';
    }
}
