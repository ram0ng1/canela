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

namespace Ramon\Canela\Events\Console;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Notification\NotificationSyncer;
use Illuminate\Console\Command;
use Ramon\Canela\Events\CalendarEvent;
use Ramon\Canela\Events\EventInvitee;
use Ramon\Canela\Events\EventsSettings;
use Ramon\Canela\Events\Notification\EventReminderBlueprint;
use Ramon\Canela\Events\Recurrence;

/**
 * O lembrete do evento: N minutos antes de cada ocorrência (a chave do admin),
 * quem marcou "Vou" recebe o alerta. `reminded_start` guarda a ocorrência já
 * lembrada, para o ciclo seguinte não repetir e a próxima ocorrência de um
 * evento recorrente ganhar o próprio lembrete.
 *
 * Construtor leve (o agendador instancia o comando em toda requisição): as
 * dependências vêm no handle().
 */
final class SendEventReminders extends Command
{
    /** @var string */
    protected $signature = 'canela:events:remind';

    /** @var string */
    protected $description = 'Envia os lembretes dos eventos que vão começar.';

    public function handle(EventsSettings $settings, NotificationSyncer $notifications): int
    {
        $minutes = $settings->reminderMinutes();

        if (! $settings->enabled() || $minutes === 0) {
            $this->info('Lembretes de evento desligados.');

            return self::SUCCESS;
        }

        $now = Carbon::now();
        $horizon = $now->copy()->addMinutes($minutes);
        $sent = 0;

        // Os candidatos: os únicos que começam até o horizonte, e os recorrentes
        // ainda vivos (a ocorrência de cada um sai da Recurrence).
        $events = CalendarEvent::query()
            ->where('going_count', '>', 0)
            ->where(static fn ($q) => $q
                ->where(static fn ($single) => $single->whereNull('recurrence')->whereBetween('starts_at', [$now, $horizon]))
                ->orWhere(static fn ($recurring) => $recurring->whereNotNull('recurrence')->where('starts_at', '<=', $horizon)
                    ->where(static fn ($until) => $until->whereNull('recurrence_until')->orWhere('recurrence_until', '>=', $now))))
            ->get();

        foreach ($events as $event) {
            [$start, , $ended] = Recurrence::current($event, $now);

            if ($ended || $start->lessThan($now) || $start->greaterThan($horizon)) {
                continue;
            }

            if ($event->reminded_start && $event->reminded_start->equalTo($start)) {
                continue;
            }

            // Marcado antes de enviar: um erro no envio não repete o lembrete.
            $event->reminded_start = $start;
            $event->save();

            $discussion = Discussion::query()->find($event->discussion_id);

            if (! $discussion || ! $settings->appliesTo($discussion)) {
                continue;
            }

            $users = EventInvitee::query()
                ->where('event_id', $event->id)
                ->where('status', EventInvitee::GOING)
                ->with('user')
                ->get()
                ->pluck('user')
                ->filter(static fn ($user) => $user && Discussion::whereVisibleTo($user)->whereKey($discussion->id)->exists())
                ->values()
                ->all();

            if ($users) {
                $notifications->sync(new EventReminderBlueprint($event, $discussion, $start), $users);
                $sent += count($users);
            }
        }

        $this->info("Lembretes de evento enviados: $sent.");

        return self::SUCCESS;
    }
}
