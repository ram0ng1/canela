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

namespace Ramon\Canela\Badges\TrustLevel;

/**
 * Os níveis de confiança. O 4 (Líder) nunca é automático: só a
 * equipe concede.
 */
final class TrustLevel
{
    public const NEW_USER = 0;

    public const BASIC = 1;

    public const MEMBER = 2;

    public const REGULAR = 3;

    public const LEADER = 4;

    public const MIN = self::NEW_USER;

    public const MAX = self::LEADER;

    /** Nome curto de cada nível (chave de tradução `ramon-canela.forum.badges.trust_levels.<nome>`). */
    public const NAMES = [
        self::NEW_USER => 'newuser',
        self::BASIC => 'basic',
        self::MEMBER => 'member',
        self::REGULAR => 'regular',
        self::LEADER => 'leader',
    ];

    public static function valid(int $level): bool
    {
        return $level >= self::MIN && $level <= self::MAX;
    }
}
