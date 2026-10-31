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

namespace Ramon\Canela\Tests\integration\api\Onebox;

use Flarum\Foundation\AbstractServiceProvider;
use Ramon\Canela\Onebox\GithubHttp;

final class FakeGithubServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->bind(GithubHttp::class, FakeGithubHttp::class);
    }
}
