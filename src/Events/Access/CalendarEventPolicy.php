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

namespace Ramon\Canela\Events\Access;

use Flarum\Discussion\Discussion;
use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\Events\CalendarEvent;

/**
 * Responder à presença de um evento (`rsvp`) é como responder ao tópico dele:
 * precisa de conta e da permissão de responder na discussão — tópico
 * trancado ou sem `discussion.reply` não aceita. Outra extensão pode
 * sobrescrever (vagas por grupo, eventos só para convidados…).
 *
 * Ver o evento é ver a discussão (ScopeCalendarEventVisibility).
 */
final class CalendarEventPolicy extends AbstractPolicy
{
    public function rsvp(User $actor, CalendarEvent $event): string
    {
        $discussion = $event->discussion;

        if ($actor->isGuest() || ! $discussion instanceof Discussion) {
            return $this->deny();
        }

        return $actor->can('reply', $discussion) ? $this->allow() : $this->deny();
    }
}
