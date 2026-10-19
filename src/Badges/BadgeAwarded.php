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

use Flarum\User\User;

/**
 * Alguém acabou de ganhar um emblema (o mesmo momento da notificação
 * "Ganhou …"; a carga inicial e as concessões antigas não contam). As
 * mensagens automáticas personalizadas com o gatilho "ganhou o emblema"
 * saem daqui.
 */
final class BadgeAwarded
{
    public function __construct(
        public readonly Badge $badge,
        public readonly UserBadge $userBadge,
        public readonly User $user,
    ) {
    }
}
