<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Builder;

/*
 * Leva as cores do fórum para a paleta padrão do tema:
 * a primária vira o violeta #595bca, de onde o tema deriva fundo, seleção e
 * links. Só troca o que ainda está no padrão — do core ou da primeira versão do
 * Canela, que usava verde e lima. Uma cor escolhida pelo admin fica como está.
 *
 * Escrita à mão, sem os auxiliares de Flarum\Database\Migration, porque
 * grava configurações (dados), não muda o esquema.
 */
return [
    'up' => static function (Builder $schema): void {
        $connection = $schema->getConnection();

        // Uma query nova por chamada: o query builder acumula os where, e
        // reaproveitá-lo faria a segunda cor procurar as duas chaves ao mesmo tempo.
        $replace = static function (string $key, array $defaults, string $color) use ($connection): void {
            $current = $connection->table('settings')->where('key', $key)->value('value');

            if ($current === null) {
                $connection->table('settings')->insert(['key' => $key, 'value' => $color]);

                return;
            }

            if (in_array(strtolower((string) $current), $defaults, true)) {
                $connection->table('settings')->where('key', $key)->update(['value' => $color]);
            }
        };

        $replace('theme_primary_color', ['#4d698e', '#1fbf0f'], '#595bca');
        $replace('theme_secondary_color', ['#4d698e', '#c3df00'], '#3b3e56');
    },

    // Desinstalar o tema não devolve as cores: a esta altura o admin já pode
    // ter ajustado a paleta a partir delas.
    'down' => static function (Builder $schema): void {
    },
];
