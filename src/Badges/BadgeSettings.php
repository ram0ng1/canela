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

namespace Ramon\Canela\Badges;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Settings\SettingsRepositoryInterface;
use Illuminate\Database\ConnectionInterface;

/**
 * As chaves dos emblemas e dos níveis de confiança num lugar só, com os
 * padrões do Discourse (`config/site_settings.yml`, área `trust_levels`).
 */
final class BadgeSettings
{
    public const BADGES_ENABLED = 'canela.badges_enabled';

    public const TRUST_LEVELS_ENABLED = 'canela.trust_levels_enabled';

    /** Emblemas em destaque no cartão do usuário (o popover dos posts). */
    public const USER_CARD = 'canela.badges_user_card';

    /** Seção "Emblemas" na aba Resumo do perfil. */
    public const SUMMARY = 'canela.badges_summary';

    /** O `max_likes_per_day` do Discourse, que os emblemas "Por amor" usam: o Flarum não limita curtidas. */
    public const MAX_LIKES_PER_DAY = 'canela.badges_max_likes_per_day';

    /**
     * Quando a primeira carga de emblemas rodou. Interna: não vai ao fórum nem
     * ao admin. Antes dela, as concessões não notificam — ligar o tema num
     * fórum antigo não pode mandar dezenas de notificações a cada membro.
     */
    public const BACKFILLED_AT = 'canela.badges_backfilled_at';

    /** Gravada pela migração que semeia os emblemas: as tabelas existem. Interna. */
    public const SCHEMA_INSTALLED = 'canela.badges_schema';

    /**
     * Os emblemas do sistema que o admin removeu (lista JSON de slugs). Interna:
     * é a marca que impede a semente de recriá-los até um "Restaurar".
     */
    public const REMOVED_SYSTEM = 'canela.badges_removed_system';

    /**
     * Requisitos dos níveis, chave => padrão do Discourse.
     *
     * @var array<string, int>
     */
    public const REQUIREMENTS = [
        'tl1_requires_topics_entered' => 5,
        'tl1_requires_read_posts' => 30,
        'tl1_requires_time_spent_mins' => 10,

        'tl2_requires_topics_entered' => 20,
        'tl2_requires_read_posts' => 100,
        'tl2_requires_time_spent_mins' => 60,
        'tl2_requires_days_visited' => 15,
        'tl2_requires_likes_received' => 1,
        'tl2_requires_likes_given' => 1,
        'tl2_requires_topic_reply_count' => 3,

        'tl3_time_period' => 100,
        'tl3_requires_days_visited' => 50,
        'tl3_requires_topics_replied_to' => 10,
        'tl3_requires_topics_viewed' => 25,
        'tl3_requires_topics_viewed_cap' => 250,
        'tl3_requires_posts_read' => 25,
        'tl3_requires_posts_read_cap' => 2000,
        'tl3_requires_topics_viewed_all_time' => 200,
        'tl3_requires_posts_read_all_time' => 500,
        'tl3_requires_max_flagged' => 5,
        'tl3_requires_likes_given' => 30,
        'tl3_requires_likes_received' => 20,
        'tl3_promotion_min_duration' => 100,
    ];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public static function requirementKey(string $name): string
    {
        return 'canela.'.$name;
    }

    public function badgesEnabled(): bool
    {
        return $this->bool(self::BADGES_ENABLED);
    }

    public function trustLevelsEnabled(): bool
    {
        return $this->bool(self::TRUST_LEVELS_ENABLED);
    }

    /** 404 em vez de 403: com o recurso desligado, a rota simplesmente não existe. */
    public function assertBadgesEnabled(): void
    {
        if (! $this->badgesEnabled()) {
            throw new RouteNotFoundException();
        }
    }

    public function requirement(string $name): int
    {
        $default = self::REQUIREMENTS[$name] ?? 0;
        $value = $this->settings->get(self::requirementKey($name), $default);

        // Um campo apagado no admin chega como '' — vale o padrão, não zero.
        return is_numeric($value) ? max(0, (int) $value) : $default;
    }

    public function maxLikesPerDay(): int
    {
        $value = (int) $this->settings->get(self::MAX_LIKES_PER_DAY, 50);

        return $value > 0 ? $value : 50;
    }

    public function backfilled(): bool
    {
        return (string) $this->settings->get(self::BACKFILLED_AT, '') !== '';
    }

    public function markBackfilled(): void
    {
        $this->settings->set(self::BACKFILLED_AT, (string) time());
    }

    /** @return list<string> */
    public function removedSystem(): array
    {
        return self::decodeList($this->settings->get(self::REMOVED_SYSTEM, '[]'));
    }

    public function markSystemRemoved(string $slug): void
    {
        $removed = $this->removedSystem();

        if (! in_array($slug, $removed, true)) {
            $removed[] = $slug;
        }

        $this->settings->set(self::REMOVED_SYSTEM, json_encode(array_values($removed)));
    }

    public function clearSystemRemoved(): void
    {
        $this->settings->set(self::REMOVED_SYSTEM, '[]');
    }

    /**
     * A mesma lista lida direto da tabela, para as migrações (que rodam sem o
     * repositório de configurações).
     *
     * @return list<string>
     */
    public static function removedSystemSlugs(ConnectionInterface $connection): array
    {
        return self::decodeList($connection->table('settings')->where('key', self::REMOVED_SYSTEM)->value('value'));
    }

    /** @return list<string> */
    private static function decodeList(mixed $raw): array
    {
        $list = is_string($raw) ? json_decode($raw, true) : null;

        return is_array($list) ? array_values(array_filter($list, 'is_string')) : [];
    }

    private function bool(string $key): bool
    {
        // O repositório devolve strings ('1', '0', ''), e o default registrado
        // no extender chega como booleano: os dois formatos passam por aqui.
        $value = $this->settings->get($key);

        return $value === true || $value === 1 || $value === '1' || $value === 'true';
    }
}
