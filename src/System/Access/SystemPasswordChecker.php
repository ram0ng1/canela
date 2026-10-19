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

namespace Ramon\Canela\System\Access;

use Flarum\User\User;
use Ramon\Canela\System\SystemUser;

/**
 * O usuário do sistema não entra com senha, nem a certa: `false` num
 * verificador de senha do core veta o login (`/login`, `/api/token`) e a
 * confirmação de senha na troca de e-mail. `null` deixa os outros decidirem.
 */
final class SystemPasswordChecker
{
    public function __construct(
        private readonly SystemUser $system,
    ) {
    }

    public function __invoke(User $user, string $password): ?bool
    {
        return $this->system->is($user) ? false : null;
    }
}
