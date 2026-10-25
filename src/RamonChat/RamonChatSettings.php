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

namespace Ramon\Canela\RamonChat;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * As chaves do admin dos recursos que o tema põe por cima do ramon/chat
 * (extend/ramonchat.php): uma chave geral e uma por recurso, todas ligadas
 * por padrão, e o limite de participantes das MDs.
 *
 * Uma tabela só porque o padrão, o atributo do fórum e o admin precisam andar
 * juntos: uma chave esquecida numa das listas não dá erro, só faz a opção
 * sumir em silêncio.
 */
final class RamonChatSettings
{
    public const MASTER = 'canela.ramonchat_features';

    public const PREFIX = 'canela.ramonchat_';

    public const DM_MAX = 'canela.ramonchat_dm_max';

    /**
     * O teto do próprio ramon/chat (`StartDirectController::MAX_PARTICIPANTS`,
     * lido com `self::`): o limite do admin só pode ficar abaixo dele.
     */
    public const DM_MAX_CEILING = 20;

    /** Recurso => padrão. O nome vira a chave `canela.ramonchat_<nome>`. */
    public const FEATURES = [
        'preferences' => true,
        'header_indicator' => true,
        'quick_reactions' => true,
        'drawer_shortcut' => true,
        'bell' => true,
        'new_message' => true,
        'group_name' => true,
        'self_dm' => true,
        'dm_guard' => true,
        'starred' => true,
        'tag_cleanup' => true,
        'auto_join' => true,
        'permalink' => true,
        'restore' => true,
        'paste_upload' => true,
        'long_press' => true,
        'collapse_deleted' => true,
        'pin_indicator' => true,
        'pin_bar' => true,
        'retention' => true,
        'delete_confirm' => true,
        'typing_poll' => true,
        'mention_warning' => true,
        'review_flags' => true,
    ];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    /** O recurso está ligado no admin (e a chave geral também). */
    public function enabled(string $feature): bool
    {
        if (! $this->flag(self::MASTER, true)) {
            return false;
        }

        return $this->flag(self::PREFIX.$feature, self::FEATURES[$feature] ?? false);
    }

    /** Quantas pessoas cabem numa MD, contando quem começa a conversa. */
    public function dmMax(): int
    {
        $value = (int) ($this->settings->get(self::DM_MAX) ?? self::DM_MAX_CEILING);

        return max(2, min(self::DM_MAX_CEILING, $value));
    }

    /**
     * O que o fórum lê (`canelaRamonChat`): os recursos ligados e os números
     * que o JS mostra (limite da MD, retenção dos canais e das MDs).
     *
     * @return array{features: array<string, bool>, dmMax: int, retentionDays: int, dmRetentionDays: int}
     */
    public function forumAttributes(): array
    {
        $features = [];

        foreach (array_keys(self::FEATURES) as $feature) {
            $features[$feature] = $this->enabled($feature);
        }

        return [
            'features' => $features,
            'dmMax' => $this->dmMax(),
            // As chaves do próprio ramon/chat, que ele não serializa.
            'retentionDays' => max(0, (int) ($this->settings->get('ramon-chat.channel_retention_days') ?? 90)),
            'dmRetentionDays' => max(0, (int) ($this->settings->get('ramon-chat.dm_retention_days') ?? 0)),
        ];
    }

    private function flag(string $key, bool $default): bool
    {
        $value = $this->settings->get($key);

        return $value === null || $value === '' ? $default : (bool) $value;
    }
}
