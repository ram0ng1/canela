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

namespace Ramon\Canela\Gaps\Invites\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\Gaps\Invites\Invite;

/**
 * Um convite é de quem o gerou: só o dono o vê e o apaga.
 *
 * Apagar não depende da permissão `canela.createInvite`: quem a perdeu (mudou
 * de grupo, foi suspenso) ainda precisa revogar os links que espalhou. Gerar
 * é a permissão global, conferida no próprio endpoint de criação.
 *
 * `forceDeny` para os outros, e não `deny`: sem ele o Gate deixaria passar os
 * administradores, e nem eles mexem nos convites dos outros.
 */
final class InvitePolicy extends AbstractPolicy
{
    public function view(User $actor, Invite $invite): string
    {
        return $this->ownerOnly($actor, $invite);
    }

    public function delete(User $actor, Invite $invite): string
    {
        return $this->ownerOnly($actor, $invite);
    }

    private function ownerOnly(User $actor, Invite $invite): string
    {
        return ! $actor->isGuest() && $invite->user_id === (int) $actor->id ? $this->allow() : $this->forceDeny();
    }
}
