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

namespace Ramon\Canela\Push\Http;

use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * O service worker em /sw.js (na raiz, para valer para o fórum todo): mostra
 * o push e, no clique, foca a aba que já está no endereço ou abre uma nova.
 */
final class ServiceWorkerController implements RequestHandlerInterface
{
    private const SCRIPT = <<<'JS'
        self.addEventListener('install', () => self.skipWaiting());
        self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
        self.addEventListener('push', (event) => {
          let data = {};
          try { data = event.data ? event.data.json() : {}; } catch (e) {}
          event.waitUntil(self.registration.showNotification(data.title || '', {
            body: data.body || '', icon: data.icon || undefined, tag: data.tag || undefined, data: { url: data.url || '/' },
          }));
        });
        self.addEventListener('notificationclick', (event) => {
          event.notification.close();
          const url = (event.notification.data && event.notification.data.url) || '/';
          event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
            for (const client of list) if (client.url === url && 'focus' in client) return client.focus();
            return self.clients.openWindow(url);
          }));
        });
        JS;

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        return new TextResponse(self::SCRIPT, 200, [
            'Content-Type' => 'application/javascript; charset=utf-8',
            'Service-Worker-Allowed' => '/',
            'Cache-Control' => 'no-cache',
        ]);
    }
}
