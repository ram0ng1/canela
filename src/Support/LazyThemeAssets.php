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
use Ernestdefoe\Wardrobe\ThemeRegistry;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Contracts\Container\Container;

/**
 * O Wardrobe, a cada recompilação dos assets, aquece TODOS os temas numa só
 * requisição (o job vai para a fila, que sem worker é síncrona). Cada tema é
 * um bundle inteiro de JS com sourcemap: com dois ou três temas a requisição
 * estoura a memória do PHP e o fórum responde 500. Aqui só o tema padrão é
 * aquecido; os outros compilam quando alguém que os escolheu abre o fórum.
 * No worker da fila (CLI, com memória própria), aquece todos, como o original.
 */
final class LazyThemeAssets extends ThemeAssets
{
    public function __construct(
        Container $container,
        private readonly ThemeRegistry $themes,
        private readonly SettingsRepositoryInterface $config,
        Cache $cache
    ) {
        parent::__construct($container, $themes, $config, $cache);
    }

    #[\Override]
    public function warmAll(): void
    {
        if (PHP_SAPI === 'cli') {
            parent::warmAll();

            return;
        }

        $default = (string) $this->config->get('wardrobe.default');

        if ($default !== '' && in_array($default, $this->themes->ids(), true)) {
            // Pedir a URL recompila o tema (CSS e JS) se ele estiver velho.
            $this->cssUrlFor($default);
        }
    }
}
