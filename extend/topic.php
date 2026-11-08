<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * Página do tópico: o "Marcar não lido" do rodapé. O fórum
 * anuncia `canelaMarkUnread` para o JS só mostrar o botão quando este
 * arquivo está carregado.
 *
 * Também os avisos de post (Ramon\Canela\Topic\PostNotice): "primeira
 * postagem" e "voltou depois de N meses", decididos quando o post nasce.
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\PostResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\Post\Event\Posted;
use Ramon\Canela\Topic\Api\DiscussionMarkUnreadField;
use Ramon\Canela\Topic\PostNotice;

return [
    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionMarkUnreadField::class),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canelaMarkUnread')->get(fn () => true),
        ]),

    (new Extend\Settings())
        ->default(PostNotice::ENABLED, true)
        ->default(PostNotice::MONTHS, 6),

    (new Extend\Event())
        ->listen(Posted::class, [PostNotice::class, 'handle']),

    (new Extend\ApiResource(PostResource::class))
        ->fields(fn () => resolve(PostNotice::class)->fields()),
];
