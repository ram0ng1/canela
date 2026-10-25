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

namespace Ramon\Canela\Events\Api;

use Flarum\Discussion\Discussion;
use Flarum\Foundation\ValidationException;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\User\User;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Events\CalendarEvent;
use Ramon\Canela\Events\EventChat;
use Ramon\Canela\Events\EventInvitee;
use Ramon\Canela\Events\EventPresenter;
use Ramon\Canela\Events\EventsSettings;
use Symfony\Contracts\Translation\TranslatorInterface;

/**
 * /api/canela-events/{id}:
 *
 * - POST …/rsvp {status: going|interested|not_going|null} responde à presença
 *   (null tira a resposta) e devolve o cartão atualizado;
 * - GET …/invitees?status=going lista quem respondeu (até 200).
 *
 * O evento só existe para quem vê a discussão, onde os eventos valem; para os
 * outros, 404.
 */
final class EventController implements RequestHandlerInterface
{
    private const INVITEES_LIMIT = 200;

    public function __construct(
        private readonly EventsSettings $settings,
        private readonly EventPresenter $presenter,
        private readonly EventChat $chat,
        private readonly TranslatorInterface $translator,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->enabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $id = (int) Arr::get($request->getQueryParams(), 'id', 0);
        $event = $this->visibleEvent($id, $actor);

        if ($request->getMethod() === 'POST') {
            return $this->rsvp($event, $actor, (array) $request->getParsedBody());
        }

        return $this->invitees($event, (string) Arr::get($request->getQueryParams(), 'status', EventInvitee::GOING));
    }

    private function visibleEvent(int $id, User $actor): CalendarEvent
    {
        /** @var CalendarEvent|null $event */
        $event = CalendarEvent::query()->with('user')->find($id);
        $discussion = $event ? Discussion::whereVisibleTo($actor)->find($event->discussion_id) : null;

        if (! $event || ! $discussion instanceof Discussion || ! $this->settings->appliesTo($discussion)) {
            throw new RouteNotFoundException();
        }

        $event->setRelation('discussion', $discussion);

        return $event;
    }

    /**
     * @param array<string, mixed> $body
     */
    private function rsvp(CalendarEvent $event, User $actor, array $body): ResponseInterface
    {
        $actor->assertRegistered();

        if (! $event->hasRsvp()) {
            throw new RouteNotFoundException();
        }

        $status = Arr::get($body, 'status');

        if ($status !== null && ! in_array($status, EventInvitee::STATUSES, true)) {
            throw new ValidationException(['status' => $this->translator->trans('ramon-canela.api.events.invalid_status')]);
        }

        /** @var EventInvitee|null $invitee */
        $invitee = EventInvitee::query()->where('event_id', $event->id)->where('user_id', $actor->id)->first();

        // Vagas: só o "vou" conta, e quem já ia não perde a vaga ao responder de novo.
        if ($status === EventInvitee::GOING && $event->max_attendees !== null && $invitee?->status !== EventInvitee::GOING
            && $event->going_count >= $event->max_attendees) {
            throw new ValidationException(['status' => $this->translator->trans('ramon-canela.api.events.full')]);
        }

        if ($status === null) {
            $invitee?->delete();
        } else {
            $invitee ??= new EventInvitee();
            $invitee->event_id = $event->id;
            $invitee->user_id = $actor->id;
            $invitee->status = $status;
            $invitee->save();
        }

        $event->refreshCounts();
        $event->save();

        if ($status === EventInvitee::GOING) {
            $this->chat->join($event, $actor);
        }

        return new JsonResponse(['event' => $this->presenter->full($event, $actor)]);
    }

    private function invitees(CalendarEvent $event, string $status): ResponseInterface
    {
        if (! in_array($status, EventInvitee::STATUSES, true)) {
            $status = EventInvitee::GOING;
        }

        $people = EventInvitee::query()
            ->where('event_id', $event->id)
            ->where('status', $status)
            ->with('user')
            ->orderBy('created_at')
            ->limit(self::INVITEES_LIMIT)
            ->get()
            // O orderBy/limit do construtor apagam o tipo da coleção: a checagem fica aqui.
            ->map(fn ($invitee) => $invitee instanceof EventInvitee && $invitee->user ? $this->presenter->user($invitee->user) : null)
            ->filter()
            ->values()
            ->all();

        return new JsonResponse([
            'status' => $status,
            'users' => $people,
            'counts' => [
                EventInvitee::GOING => $event->going_count,
                EventInvitee::INTERESTED => $event->interested_count,
                EventInvitee::NOT_GOING => $event->not_going_count,
            ],
        ]);
    }
}
