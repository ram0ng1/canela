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

use Flarum\User\User;

/**
 * O nível de confiança de alguém mudou numa promoção (ou rebaixamento) de
 * verdade, e não na carga inicial dos níveis. As mensagens automáticas de
 * nível 1 e 2 (como as do Discourse) saem daqui.
 */
final class TrustLevelChanged
{
    public function __construct(
        public readonly User $user,
        public readonly int $from,
        public readonly int $to,
    ) {
    }
}
