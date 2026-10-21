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

namespace Ramon\Canela\Backgrounds;

/**
 * O fundo do fórum e o das páginas de entrar/cadastrar, escolhidos no admin.
 *
 * - tinted: o degradê tingido com as peças desfocadas (o padrão);
 * - gradient: o mesmo degradê, sem as peças;
 * - solid: a cor tingida, lisa;
 * - plain: a superfície lisa, sem tinta;
 * - image: uma imagem enviada no admin, cobrindo a janela.
 *
 * As páginas de entrar/cadastrar ainda têm `same` (o mesmo do fórum).
 */
final class Backgrounds
{
    public const FORUM = 'canela.forum_background';
    public const AUTH = 'canela.auth_background';

    /** A chave antiga (liga/desliga): vale enquanto o fundo novo não foi escolhido. */
    public const LEGACY_TINTED = 'canela.tinted_background';

    public const STYLES = ['tinted', 'gradient', 'solid', 'plain', 'image'];

    public const TARGETS = ['forum', 'auth'];

    public static function imageKey(string $target): string
    {
        return "canela.{$target}_background_image";
    }

    public static function forum(mixed $value, mixed $legacyTinted): string
    {
        if (is_string($value) && in_array($value, self::STYLES, true)) {
            return $value;
        }

        // Quem desligou o "fundo tingido" antes continua com o liso.
        return $legacyTinted === null || $legacyTinted === '' || (bool) $legacyTinted ? 'tinted' : 'plain';
    }

    public static function auth(mixed $value): string
    {
        return is_string($value) && in_array($value, self::STYLES, true) ? $value : 'same';
    }
}
