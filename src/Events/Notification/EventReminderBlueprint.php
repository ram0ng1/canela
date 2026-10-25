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

namespace Ramon\Canela\Events\Notification;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Discussion\Discussion;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\User\User;
use Ramon\Canela\Events\CalendarEvent;

/**
 * "O evento X começa em 15 minutos": o alerta de quem marcou "Vou". O assunto
 * é a discussão do evento; o horário vai nos dados, para o texto do alerta.
 */
final class EventReminderBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly CalendarEvent $event,
        public readonly Discussion $discussion,
        public readonly Carbon $start,
    ) {
    }

    #[\Override]
    public function getSubject(): AbstractModel
    {
        return $this->discussion;
    }

    #[\Override]
    public function getFromUser(): ?User
    {
        return $this->event->user;
    }

    #[\Override]
    public function getData(): mixed
    {
        return [
            'eventId' => $this->event->id,
            'name' => $this->event->name,
            'startsAt' => $this->start->toIso8601String(),
        ];
    }

    #[\Override]
    public static function getType(): string
    {
        return 'canelaEventReminder';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return Discussion::class;
    }
}
