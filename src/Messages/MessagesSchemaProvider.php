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

namespace Ramon\Canela\Messages;

use Flarum\Extension\Event\Disabled;
use Flarum\Extension\Event\Enabled;
use Flarum\Extension\ExtensionManager;
use Flarum\Foundation\AbstractServiceProvider;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\ConnectionInterface;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Garante o esquema do tema nas tabelas do flarum/messages
 * (MessagesSchema::install()) mesmo quando as migrations `*_messages_*`
 * rodaram antes de o flarum/messages existir:
 *
 * - ao habilitar o flarum/messages (o `Enabled` sai depois das migrations
 *   dele), instala de novo, sem confiar na marca;
 * - ao desabilitá-lo, tira a marca (uma desinstalação apaga as tabelas);
 * - a cada requisição com ele ligado, só se a marca faltar: o fórum em que
 *   o flarum/messages foi ligado antes desta correção. Com a marca, é uma
 *   leitura das configurações, que já estão em memória.
 *
 * Uma falha (duas requisições criando a mesma coluna ao mesmo tempo, banco
 * só de leitura) vai para o log e não derruba a requisição: as perguntas do
 * MessagesSchema continuam olhando o esquema de verdade.
 */
final class MessagesSchemaProvider extends AbstractServiceProvider
{
    #[\Override]
    public function boot(Dispatcher $events, SettingsRepositoryInterface $settings, ConnectionInterface $db, LoggerInterface $log): void
    {
        $events->listen(Enabled::class, static function (Enabled $event) use ($settings, $db, $log): void {
            if ($event->extension->getId() === 'flarum-messages') {
                self::ensure($db, $settings, $log, true);
            }
        });

        $events->listen(Disabled::class, static function (Disabled $event) use ($db): void {
            if ($event->extension->getId() === 'flarum-messages') {
                MessagesSchema::forget($db);
            }
        });

        if ($settings->get(MessagesSchema::MARKER) !== MessagesSchema::VERSION && $this->messagesEnabled()) {
            self::ensure($db, $settings, $log);
        }
    }

    private function messagesEnabled(): bool
    {
        try {
            return $this->container->make(ExtensionManager::class)->isEnabled('flarum-messages');
        } catch (Throwable) {
            return false;
        }
    }

    private static function ensure(ConnectionInterface $db, SettingsRepositoryInterface $settings, LoggerInterface $log, bool $force = false): void
    {
        try {
            MessagesSchema::ensure($db, $settings, $force);
        } catch (Throwable $error) {
            $log->error('[ramon/canela] esquema das mensagens não instalado: '.$error->getMessage());
        }
    }
}
