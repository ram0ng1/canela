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

use Flarum\Frontend\Compiler\JsCompiler;

/**
 * O compilador de JS do core sem o sourcemap, para produção (debug desligado).
 *
 * Montar o sourcemap é a parte cara de compilar um bundle: o core lê e funde o
 * `.map` de cada extensão (vários MB) na memória. Com o Wardrobe isso se
 * repete para cada tema, e num servidor de 1 GB a compilação estourava a
 * memória (erro 500). Sem o mapa, compilar é só concatenar os arquivos.
 */
class LeanJsCompiler extends JsCompiler
{
    #[\Override]
    protected function renderOutput(array $sources): ?string
    {
        if ($sources === []) {
            return null;
        }

        $output = [];

        foreach ($sources as $source) {
            $output[] = $this->format($source->getContent());
        }

        return implode("\n", $output);
    }
}
