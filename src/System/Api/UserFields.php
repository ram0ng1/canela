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

namespace Ramon\Canela\System\Api;

use Flarum\Api\Schema;
use Flarum\User\User;
use Ramon\Canela\System\SystemUser;

/** `canelaIsSystem` nos usuários: o fórum põe o escudo ao lado do nome. */
final class UserFields
{
    public function __construct(
        private readonly SystemUser $system,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('canelaIsSystem')
                ->get(fn (User $user) => $this->system->is($user)),
        ];
    }
}
