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

namespace Ramon\Canela\Gaps;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * As chaves liga/desliga dos recursos com backend que faltavam (gaps), já
 * convertidas. Cada ponto de entrada (rotas, ouvintes, campos da API)
 * consulta a sua: desligado, o recurso some do fórum e as rotas respondem 404.
 */
final class GapsSettings
{
    public const POST_EDITED = 'canela.notify_post_edited';

    public const TOPIC_LINKED = 'canela.notify_topic_linked';

    public const TAG_TRACKING = 'canela.tag_tracking_enabled';

    public const IGNORE_USERS = 'canela.ignore_users_enabled';

    public const INVITES = 'canela.invites_enabled';

    public const INVITE_DAYS = 'canela.invites_expire_days';

    public const MOVE_POSTS = 'canela.move_posts_enabled';

    public const NOT_FOUND = 'canela.not_found_page';

    public const MARKDOWN_TABLES = 'canela.markdown_tables';

    public const LOCAL_DATES = 'canela.local_dates';

    public const CATEGORY_UNREAD = 'canela.sidebar_category_dots';

    /** Padrões: tudo ligado, como o Discourse vem. */
    public const DEFAULTS = [
        self::POST_EDITED => true,
        self::TOPIC_LINKED => true,
        self::TAG_TRACKING => true,
        self::IGNORE_USERS => true,
        self::INVITES => true,
        self::INVITE_DAYS => 7,
        self::MOVE_POSTS => true,
        self::NOT_FOUND => true,
        self::MARKDOWN_TABLES => true,
        self::LOCAL_DATES => true,
    ];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings
    ) {
    }

    public function on(string $key): bool
    {
        $value = $this->settings->get($key, self::DEFAULTS[$key] ?? false);

        return $value === true || $value === 1 || $value === '1' || $value === 'true';
    }

    /** Dias de validade de um convite novo: de 1 a 90. */
    public function inviteDays(): int
    {
        $days = (int) $this->settings->get(self::INVITE_DAYS, self::DEFAULTS[self::INVITE_DAYS]);

        return max(1, min(90, $days ?: (int) self::DEFAULTS[self::INVITE_DAYS]));
    }
}
