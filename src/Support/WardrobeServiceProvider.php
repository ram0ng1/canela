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

/**
 * Troca o ThemeAssets do Wardrobe pelo que só aquece o tema padrão (ver
 * LazyThemeAssets). Registrado só com o Wardrobe habilitado.
 */
final class WardrobeServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->bind(ThemeAssets::class, LazyThemeAssets::class);
    }
}
