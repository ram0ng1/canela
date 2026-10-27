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

namespace Ramon\Canela\BugReports\Access;

use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * `BugReport::whereVisibleTo($actor)`: a administração vê todos; os demais,
 * só os próprios. O relatório de outra pessoa responde como inexistente (404),
 * e um visitante não vê nenhum.
 */
final class ScopeBugReportVisibility
{
    public function __invoke(User $actor, Builder $query): void
    {
        if (BugReportPolicy::manages($actor)) {
            return;
        }

        if ($actor->isGuest()) {
            $query->whereRaw('1 = 0');

            return;
        }

        $query->where('canela_bug_reports.user_id', $actor->id);
    }
}
