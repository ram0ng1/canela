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

namespace Ramon\Canela\Onebox;

use Flarum\Foundation\AbstractServiceProvider;

/** O cliente HTTP do onebox (os testes registram um falso depois deste). */
final class OneboxServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->bindIf(GithubHttp::class, GuzzleGithubHttp::class);
    }
}
