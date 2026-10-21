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
 * Marcadores (bookmarks): marcar posts e o tópico inteiro, com
 * nome e lembrete, e a página "Marcadores" no perfil.
 *
 * Tudo fica registrado mesmo com o recurso desligado no admin — as rotas da
 * API são montadas no boot, antes das configurações — e cada ponto de entrada
 * consulta `canela.bookmarks_enabled` (BookmarksFeature).
 */

use Flarum\Api\Resource\PostResource;
use Flarum\Extend;
use Ramon\Canela\Bookmarks\Access\BookmarkPolicy;
use Ramon\Canela\Bookmarks\Access\ScopeBookmarkVisibility;
use Ramon\Canela\Bookmarks\Api\BookmarkResource;
use Ramon\Canela\Bookmarks\Api\PostBookmarkFields;
use Ramon\Canela\Bookmarks\Bookmark;
use Ramon\Canela\Bookmarks\BookmarksFeature;
use Ramon\Canela\Bookmarks\Console\ReminderSchedule;
use Ramon\Canela\Bookmarks\Console\SendBookmarkReminders;
use Ramon\Canela\Bookmarks\Notification\BookmarkReminderBlueprint;

return [
    new Extend\ApiResource(BookmarkResource::class),

    (new Extend\ApiResource(PostResource::class))
        ->fields(PostBookmarkFields::class),

    (new Extend\ModelVisibility(Bookmark::class))
        ->scope(ScopeBookmarkVisibility::class),

    (new Extend\Policy())
        ->modelPolicy(Bookmark::class, BookmarkPolicy::class),

    // Só o alerta, ligado por padrão. O usuário desliga em Configurações →
    // Notificações, como qualquer outro tipo.
    (new Extend\Notification())
        ->type(BookmarkReminderBlueprint::class, ['alert']),

    (new Extend\Console())
        ->command(SendBookmarkReminders::class)
        ->schedule(SendBookmarkReminders::class, ReminderSchedule::class),

    (new Extend\Settings())
        ->default(BookmarksFeature::ENABLED, true)
        ->default(BookmarksFeature::TOPIC_BUTTON, true)
        ->default(BookmarksFeature::USER_MENU, true)
        ->serializeToForum('canelaBookmarksEnabled', BookmarksFeature::ENABLED, 'boolval')
        ->serializeToForum('canelaBookmarksTopicButton', BookmarksFeature::TOPIC_BUTTON, 'boolval')
        ->serializeToForum('canelaBookmarksUserMenu', BookmarksFeature::USER_MENU, 'boolval'),
];
