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

namespace Ramon\Canela\Update;

use Flarum\Foundation\Paths;

/**
 * A constraint do composer.json do fórum que impede o `composer update` de
 * trazer a próxima versão do tema.
 *
 * Enquanto o tema está em 0.x, o Composer lê `^0.1.11` como "só 0.1.x" (e
 * `~0.1.11` também): a 0.2.0 nunca chega, e o update termina sem erro. Uma
 * versão exata (`0.2.4`) trava em qualquer série. É o que acontece com quem
 * instalou com `composer require ramon/canela`, sem `:"*"`.
 *
 * Só lê o arquivo, sem rede: não sabe se há versão nova, só que a constraint
 * não deixaria passar dela.
 */
class UpdateBlocker
{
    public const PACKAGE = 'ramon/canela';

    public function __construct(protected Paths $paths)
    {
    }

    /** A constraint que trava, ou null se o update pode subir de versão. */
    public function constraint(): ?string
    {
        $file = $this->paths->base.'/composer.json';
        $json = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
        $constraint = is_array($json) ? ($json['require'][self::PACKAGE] ?? null) : null;

        return is_string($constraint) && self::blocks($constraint) ? trim($constraint) : null;
    }

    public static function blocks(string $constraint): bool
    {
        $constraint = trim($constraint);

        // Versão exata: `0.2.4`, `v0.2.4`, `=0.2.4`.
        if (preg_match('/^=?\s*v?\d+\.\d+\.\d+(-[\w.]+)?$/i', $constraint)) {
            return true;
        }

        // Caret ou til em 0.x, sozinho: não passa da minor. Com `||` ou um
        // intervalo, quem escreveu já escolheu as séries.
        return (bool) preg_match('/^[\^~]\s*v?0\.[\w.-]*$/i', $constraint);
    }
}
