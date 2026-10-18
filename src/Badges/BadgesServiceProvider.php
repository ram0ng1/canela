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

namespace Ramon\Canela\Badges;

use Flarum\Foundation\AbstractServiceProvider;

/**
 * Capabilities guarda o que já perguntou ao esquema do banco; como
 * singleton, cada tabela é verificada uma vez por requisição, e não uma vez
 * por emblema ou por ouvinte.
 */
final class BadgesServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->singleton(Capabilities::class);
        $this->container->singleton(BadgeSettings::class);
    }
}
