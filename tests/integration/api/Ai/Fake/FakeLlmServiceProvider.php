<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Ai\Fake;

use Flarum\Foundation\AbstractServiceProvider;
use Ramon\Canela\Ai\Llm\LlmFactory;

/** Troca a LlmFactory pela FakeLlmFactory no container (`Extend\ServiceProvider`). */
final class FakeLlmServiceProvider extends AbstractServiceProvider
{
    #[\Override]
    public function register(): void
    {
        $this->container->bind(LlmFactory::class, FakeLlmFactory::class);
    }
}
