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

namespace Ramon\Canela\Gaps;

use Flarum\Foundation\AbstractServiceProvider;
use Ramon\Canela\Gaps\Invites\InviteService;

/**
 * Uma instância por requisição das peças que guardam cálculo: as tags com
 * novidade são calculadas uma vez para todas as tags do documento, e o
 * "as tabelas existem?" dos convites é perguntado uma vez só.
 */
final class GapsServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->singleton(UnreadTags::class);
        $this->container->singleton(InviteService::class);
    }
}
