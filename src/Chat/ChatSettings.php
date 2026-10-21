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
 * As rotas da API são montadas no boot, sem acesso às configurações: com o chat
 * desligado no admin elas continuam registradas, mas cada uma pergunta aqui e
 * responde 404, como se o recurso não existisse.
 */
final class ChatSettings
{
    public const ENABLED = 'canela.chat_enabled';

    /** Grupos (ids separados por vírgula) que usam o chat — o `chat_allowed_groups`. */
    public const ALLOWED_GROUPS = 'canela.chat_allowed_groups';

    public const DM_ENABLED = 'canela.chat_dm_enabled';

    /** Grupos (ids separados por vírgula) que podem abrir mensagens diretas. */
    public const DM_GROUPS = 'canela.chat_dm_groups';

    /** Quem cria canais públicos, além dos administradores. */
    public const CREATE_CHANNEL_GROUPS = 'canela.chat_create_channel_groups';

    /** Quem modera (apaga mensagens alheias, fixa, fecha canais), além dos administradores. */
    public const MODERATOR_GROUPS = 'canela.chat_moderator_groups';

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
        self::ALLOWED_GROUPS => '3',
        self::DM_ENABLED => true,
        self::DM_GROUPS => '3',
        self::CREATE_CHANNEL_GROUPS => '',
        self::MODERATOR_GROUPS => '4',
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

    /**
     * Ids de grupo guardados como "3,4" (o admin grava a lista de marcados).
     *
     * @return int[]
     */
    public function groups(string $key): array
    {
        $raw = (string) $this->settings->get($key, self::DEFAULTS[$key] ?? '');

        return array_values(array_unique(array_filter(array_map('intval', preg_split('/[\s,]+/', $raw) ?: []), static fn (int $id) => $id > 0)));
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
