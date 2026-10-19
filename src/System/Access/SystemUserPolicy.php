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

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\System\SystemUser;

/**
 * Ninguém manda mensagem para o usuário do sistema: ninguém lê a caixa
 * dele. O `message` do flarum/messages decide se alguém pode receber
 * mensagens; um `forceDeny` aqui vence até o admin, e some o botão "Mensagem".
 */
final class SystemUserPolicy extends AbstractPolicy
{
    public function __construct(
        private readonly SystemUser $system,
    ) {
    }

    public function message(User $actor, User $user): ?string
    {
        return $this->system->is($user) && ! $this->system->is($actor) ? $this->forceDeny() : null;
    }
}
