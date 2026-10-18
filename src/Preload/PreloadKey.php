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

namespace Ramon\Canela\Preload;

/**
 * A chave de um pedido pré-carregado: o caminho na API e os parâmetros
 * achatados ("page[limit]=20") em ordem alfabética, sem codificação de URL.
 *
 * O JS (`utils/preload.ts`) monta a mesma chave a partir dos parâmetros que
 * ia mandar; só quando as duas batem o dado pronto é usado. Um parâmetro a
 * mais ou a menos de um dos lados não quebra nada: a página faz o pedido.
 */
final class PreloadKey
{
    /** @param array<string, mixed> $query */
    public static function make(string $path, array $query = []): string
    {
        $pairs = [];
        self::flatten($query, '', $pairs);
        sort($pairs, SORT_STRING);

        return trim($path, '/').'?'.implode('&', $pairs);
    }

    /**
     * @param array<array-key, mixed> $value
     * @param list<string> $pairs
     */
    private static function flatten(array $value, string $prefix, array &$pairs): void
    {
        foreach ($value as $key => $item) {
            // Como no JS: o Mithril deixa de fora o valor vazio.
            if ($item === null || $item === '') {
                continue;
            }

            $name = $prefix === '' ? (string) $key : $prefix.'['.$key.']';

            if (is_array($item)) {
                self::flatten($item, $name, $pairs);
            } else {
                $pairs[] = $name.'='.(is_bool($item) ? ($item ? 'true' : 'false') : (string) $item);
            }
        }
    }
}
