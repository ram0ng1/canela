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

namespace Ramon\Canela\Brand;

/**
 * A identidade visual de cada fórum: o monograma, a forma e o padrão saem do
 * nome (js/src/common/brand), e as cores, da primária. Aqui ficam só as
 * escolhas do admin por área:
 *
 * - theme: a arte gerada pelo tema (na 404, a ilustração do modelo);
 * - image: uma imagem enviada no admin;
 * - none: nada.
 */
final class Brand
{
    public const AREAS = ['header', 'welcome', 'empty', 'auth', 'not_found'];

    public const MODES = ['theme', 'image', 'none'];

    /** O modelo, a borda e o efeito em volta; `auto` deixa o nome escolher. */
    public const SHAPES = ['auto', 'circle', 'rounded', 'square', 'arch', 'leaf'];
    public const BORDERS = ['fill', 'outline', 'ring'];
    public const EFFECTS = ['auto', 'dots', 'lines', 'rings', 'grid', 'glow', 'none'];

    public static function modeKey(string $area): string
    {
        return "canela.brand_{$area}";
    }

    public static function imageKey(string $area): string
    {
        return "canela.brand_{$area}_image";
    }

    public static function mode(mixed $value): string
    {
        return is_string($value) && in_array($value, self::MODES, true) ? $value : 'theme';
    }

    /** @param list<string> $choices O valor, se estiver na lista; senão, o primeiro dela. */
    public static function choice(mixed $value, array $choices): string
    {
        return is_string($value) && in_array($value, $choices, true) ? $value : $choices[0];
    }

    /** `not_found` => `canelaBrandNotFound`. */
    public static function attribute(string $area, string $suffix = ''): string
    {
        return 'canelaBrand'.str_replace('_', '', ucwords($area, '_')).$suffix;
    }
}
