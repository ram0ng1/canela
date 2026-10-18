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

use Ernestdefoe\Wardrobe\ThemeAssets;
use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Foundation\Config;
use Flarum\Frontend\Compiler\JsCompiler;

/**
 * Wardrobe leve: o ThemeAssets que nunca compila na visita (ver
 * LazyThemeAssets) e, em produção, o compilador de JS sem sourcemap (ver
 * LeanJsCompiler). Registrado só com o Wardrobe habilitado.
 */
final class WardrobeServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->bind(ThemeAssets::class, LazyThemeAssets::class);

        if (! $this->container->make(Config::class)->inDebugMode()) {
            $this->container->bind(JsCompiler::class, LeanJsCompiler::class);
        }
    }
}
