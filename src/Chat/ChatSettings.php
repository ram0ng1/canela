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

namespace Ramon\Canela\Chat;

use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\Eloquent\ModelNotFoundException;

/**
 * As configurações do chat (`canela.chat_*`) e o liga/desliga do recurso.
 *
 * Quem usa, manda MD, cria canais e modera não mora aqui: são permissões do
 * Flarum (ChatAccess::PERMISSION_*), em Administração → Permissões.
 *
 * As rotas da API são montadas no boot, sem acesso às configurações: com o chat
 * desligado no admin elas continuam registradas, mas cada uma pergunta aqui e
 * responde 404, como se o recurso não existisse.
 */
final class ChatSettings
{
    public const ENABLED = 'canela.chat_enabled';

    public const DM_ENABLED = 'canela.chat_dm_enabled';

    public const THREADS_ENABLED = 'canela.chat_threads_enabled';

    public const MAX_MESSAGE_LENGTH = 'canela.chat_max_message_length';

    public const UPLOADS_ENABLED = 'canela.chat_uploads_enabled';

    public const UPLOAD_MAX_KB = 'canela.chat_upload_max_kb';

    public const PINS_ENABLED = 'canela.chat_pins_enabled';

    /** Dias que as mensagens dos canais públicos ficam guardadas (0 = para sempre). */
    public const RETENTION_DAYS = 'canela.chat_retention_days';

    /** O mesmo, para as mensagens diretas. */
    public const DM_RETENTION_DAYS = 'canela.chat_dm_retention_days';

    /** Máximo de pessoas numa mensagem direta, contando quem cria. */
    public const DM_MAX_USERS = 'canela.chat_dm_max_users';

    /** As seções "Canais" e "Mensagens diretas" na barra lateral. */
    public const SIDEBAR = 'canela.chat_sidebar';

    /** O intervalo do polling quando o websocket do flarum/realtime não está disponível. */
    public const POLL_SECONDS = 'canela.chat_poll_seconds';

    /** Padrões de cada chave, num lugar só: o extend e os leitores usam os mesmos. */
    public const DEFAULTS = [
        // Desligado por padrão: o chat é um recurso grande e opcional; quem quiser
        // liga no admin (e ele não colide com outra extensão de chat instalada).
        self::ENABLED => false,
        self::DM_ENABLED => true,
        self::THREADS_ENABLED => true,
        self::MAX_MESSAGE_LENGTH => 6000,
        self::UPLOADS_ENABLED => true,
        self::UPLOAD_MAX_KB => 4096,
        self::PINS_ENABLED => true,
        self::RETENTION_DAYS => 0,
        self::DM_RETENTION_DAYS => 0,
        self::DM_MAX_USERS => 20,
        self::SIDEBAR => true,
        self::POLL_SECONDS => 5,
    ];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public static function make(): self
    {
        return resolve(self::class);
    }

    public function enabled(): bool
    {
        return $this->bool(self::ENABLED);
    }

    /**
     * @throws ModelNotFoundException
     */
    public function assertEnabled(): void
    {
        if (! $this->enabled()) {
            throw new ModelNotFoundException();
        }
    }

    public function bool(string $key): bool
    {
        $value = $this->settings->get($key, self::DEFAULTS[$key] ?? false);

        return $value === true || $value === 1 || $value === '1' || $value === 'true';
    }

    public function int(string $key, int $min = 0, ?int $max = null): int
    {
        $value = (int) $this->settings->get($key, self::DEFAULTS[$key] ?? 0);
        $value = max($min, $value);

        return $max === null ? $value : min($max, $value);
    }

    public function maxMessageLength(): int
    {
        return $this->int(self::MAX_MESSAGE_LENGTH, 50, 50000);
    }

    public function dmMaxUsers(): int
    {
        return $this->int(self::DM_MAX_USERS, 2, 100);
    }

    public function uploadMaxKb(): int
    {
        return $this->int(self::UPLOAD_MAX_KB, 64, 51200);
    }

    public function pollSeconds(): int
    {
        return $this->int(self::POLL_SECONDS, 2, 120);
    }
}
