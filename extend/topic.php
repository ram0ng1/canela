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
 * Página do tópico: o "Marcar não lido" do rodapé (Discourse). O fórum
 * anuncia `canelaMarkUnread` para o JS só mostrar o botão quando este
 * arquivo está carregado.
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Ramon\Canela\Topic\Api\DiscussionMarkUnreadField;

return [
    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionMarkUnreadField::class),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canelaMarkUnread')->get(fn () => true),
        ]),
];
