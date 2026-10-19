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

namespace Ramon\Canela\System;

use Flarum\Foundation\AbstractServiceProvider;

/**
 * Uma instância só do SystemUser: os blueprints de notificação, o payload do
 * fórum e as mensagens automáticas perguntam por ele várias vezes na mesma
 * requisição, e cada instância nova buscava o usuário de novo.
 */
final class SystemServiceProvider extends AbstractServiceProvider
{
    public function register(): void
    {
        $this->container->singleton(SystemUser::class);
    }
}
