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
 * PWA e push no navegador:
 *
 * - /manifest.webmanifest e o <link> no <head>: o fórum pode ser instalado
 *   como app (nome, cor e ícone da Aparência);
 * - /sw.js, o service worker que mostra o push e abre o tópico no clique;
 * - o canal "Push" das notificações (driver do core, com a coluna própria em
 *   Configurações → Notificações) e a rota que grava o aparelho.
 *
 * As chaves VAPID são geradas sozinhas na primeira vez (Ramon\Canela\Push\Push).
 */

use Flarum\Extend;
use Flarum\Frontend\Document;
use Flarum\Settings\SettingsRepositoryInterface;
use Ramon\Canela\Push\Http\ManifestController;
use Ramon\Canela\Push\Http\ServiceWorkerController;
use Ramon\Canela\Push\Http\SubscriptionController;
use Ramon\Canela\Push\Push;
use Ramon\Canela\Push\PushNotificationDriver;

return [
    (new Extend\Settings())
        ->default(Push::PWA, true)
        ->default(Push::ENABLED, true)
        ->serializeToForum('canelaPwa', Push::PWA, 'boolval')
        ->serializeToForum('canelaPushKey', Push::ENABLED, static fn ($on) => $on ? resolve(Push::class)->keys()['publicKey'] : null),

    (new Extend\Notification())
        ->driver('push', PushNotificationDriver::class),

    (new Extend\Routes('forum'))
        ->get('/sw.js', 'canela.sw', ServiceWorkerController::class)
        ->get('/manifest.webmanifest', 'canela.manifest', ManifestController::class),

    (new Extend\Routes('api'))
        ->post('/canela-push-subscriptions', 'canela.push.subscribe', SubscriptionController::class)
        ->delete('/canela-push-subscriptions', 'canela.push.unsubscribe', SubscriptionController::class),

    (new Extend\Frontend('forum'))
        ->content(static function (Document $document): void {
            $settings = resolve(SettingsRepositoryInterface::class);

            if (! $settings->get(Push::PWA)) {
                return;
            }

            $base = resolve(Flarum\Http\UrlGenerator::class)->to('forum')->base();
            $document->head[] = '<link rel="manifest" href="'.e($base.'/manifest.webmanifest').'">';
        }),
];
