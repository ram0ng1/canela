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

namespace Ramon\Canela\Assign;

use Flarum\Discussion\Discussion;
use Flarum\User\User;

/**
 * O responsável pelo tópico mudou. `$assignee` é null quando a atribuição
 * foi removida. O flarum/audit grava este evento como
 * `discussion.assigned` / `discussion.unassigned`.
 */
final class Assigned
{
    public function __construct(
        public readonly Discussion $discussion,
        public readonly User $actor,
        public readonly ?User $assignee,
    ) {
    }
}
