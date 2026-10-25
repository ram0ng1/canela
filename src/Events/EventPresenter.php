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

namespace Ramon\Canela\Events;

use Carbon\Carbon;
use Flarum\Http\SlugManager;
use Flarum\User\User;

/**
 * O evento como o fórum o recebe: no post (o cartão inteiro), na resposta da
 * presença e na lista de próximos eventos. Pessoas vão só com o que aparece em
 * público (nome, nome de exibição, avatar e cor), nunca o modelo inteiro.
 */
final class EventPresenter
{
    /** Quantos avatares de "vou" o cartão mostra. */
    public const SAMPLE = 10;

    public function __construct(
        private readonly EventsSettings $settings,
    ) {
    }

    /**
     * O resumo da lista e do cabeçalho do tópico: nome e a ocorrência de agora.
     *
     * @return array<string, mixed>
     */
    public function summary(CalendarEvent $event): array
    {
        [$start, $end, $ended] = Recurrence::current($event);

        return [
            'id' => $event->id,
            'name' => $event->name,
            'startsAt' => $start->toIso8601String(),
            'endsAt' => $event->ends_at ? $end->toIso8601String() : null,
            'ended' => $ended,
            'recurrence' => $event->recurrence,
            'timezone' => $event->timezone,
        ];
    }

    /**
     * O cartão do evento, do ponto de vista de quem pede.
     *
     * @return array<string, mixed>
     */
    public function full(CalendarEvent $event, User $actor): array
    {
        $mine = $actor->isGuest() ? null : EventInvitee::query()
            ->where('event_id', $event->id)
            ->where('user_id', $actor->id)
            ->value('status');

        $sample = EventInvitee::query()
            ->where('event_id', $event->id)
            ->where('status', EventInvitee::GOING)
            ->with('user')
            ->orderBy('created_at')
            ->limit(self::SAMPLE)
            ->get()
            // O orderBy/limit do construtor apagam o tipo da coleção: a checagem fica aqui.
            ->map(fn ($invitee) => $invitee instanceof EventInvitee && $invitee->user ? $this->user($invitee->user) : null)
            ->filter()
            ->values()
            ->all();

        $full = $event->max_attendees !== null && $event->going_count >= $event->max_attendees;

        return [
            ...$this->summary($event),
            'firstStartsAt' => $event->starts_at->toIso8601String(),
            'status' => $event->status,
            'recurrenceUntil' => $event->recurrence_until?->toDateString(),
            'url' => $event->url,
            'location' => $event->location,
            'description' => $event->description,
            'maxAttendees' => $event->max_attendees,
            'chat' => $event->chat_enabled && $this->settings->chatAvailable(),
            'chatChannelId' => $this->settings->chatAvailable() ? $event->chat_channel_id : null,
            'going' => $event->going_count,
            'interested' => $event->interested_count,
            'notGoing' => $event->not_going_count,
            'full' => $full,
            'myStatus' => $mine,
            'canRsvp' => ! $actor->isGuest() && $event->hasRsvp(),
            'creator' => $event->user ? $this->user($event->user) : null,
            'sample' => $sample,
        ];
    }

    /**
     * Uma pessoa, só com o público.
     *
     * @return array<string, mixed>
     */
    public function user(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'username' => $user->username,
            'displayName' => $user->display_name,
            'avatarUrl' => $user->avatar_url,
            'slug' => resolve(SlugManager::class)->forResource(User::class)->toSlug($user),
        ];
    }

    /** Agora, para quem precisar da mesma referência de tempo. */
    public static function now(): Carbon
    {
        return Carbon::now();
    }
}
