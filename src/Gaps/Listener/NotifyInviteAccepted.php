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

namespace Ramon\Canela\Gaps\Listener;

use Flarum\User\Event\Activated;
use Flarum\User\Event\Registered;
use Illuminate\Contracts\Events\Dispatcher;
use Ramon\Canela\Gaps\Invites\InviteService;

/**
 * "Fulano aceitou seu convite" só quando a conta passa a valer: ao confirmar
 * o e-mail (Activated), ou já no cadastro quando ele chega confirmado (OAuth,
 * admin). Avisar antes seria anunciar uma conta que pode nunca ser
 * confirmada. O mesmo momento das boas-vindas (System\Listener\SendAutoMessages).
 */
final class NotifyInviteAccepted
{
    public function __construct(
        private readonly InviteService $invites,
    ) {
    }

    public function subscribe(Dispatcher $events): void
    {
        $events->listen(Registered::class, function (Registered $event): void {
            if ($event->user->is_email_confirmed) {
                $this->invites->notifyAccepted($event->user);
            }
        });

        $events->listen(Activated::class, fn (Activated $event) => $this->invites->notifyAccepted($event->user));
    }
}
