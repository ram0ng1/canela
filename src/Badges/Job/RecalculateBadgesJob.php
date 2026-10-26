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

namespace Ramon\Canela\Badges\Job;

use Flarum\Queue\AbstractJob;
use Ramon\Canela\Badges\BadgeGranter;

/**
 * "Conceder agora", na fila: a mesma carga do comando diário, fora da
 * requisição do admin (como o RecalculateBadgesJob do fof/badges). Com a
 * fila `sync`, o padrão do Flarum, roda na hora, dentro da própria requisição.
 *
 * Duas cargas não rodam juntas: a trava global do BadgeGranter pula esta se o
 * agendador estiver no meio da dele.
 */
final class RecalculateBadgesJob extends AbstractJob
{
    public function handle(BadgeGranter $granter): void
    {
        $granter->backfill();
    }
}
