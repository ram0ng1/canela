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

/*
 * Aviso no painel do tema quando a constraint do composer.json do fórum não
 * deixa o `composer update` trazer a próxima versão (src/Update).
 */

use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Ramon\Canela\Update\UpdateBlocker;

return [
    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Str::make('canelaUpdateBlocker')
                ->nullable()
                ->visible(fn (object $forum, Context $context) => $context->getActor()->isAdmin())
                ->get(fn () => resolve(UpdateBlocker::class)->constraint()),
        ]),
];
