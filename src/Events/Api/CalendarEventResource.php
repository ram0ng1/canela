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

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Api\Serializer;
use Flarum\Foundation\ValidationException;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Psr\Http\Message\ResponseInterface;
use Ramon\Canela\Events\CalendarEvent;
use Ramon\Canela\Events\EventChat;
use Ramon\Canela\Events\EventInvitee;
use Ramon\Canela\Events\EventPresenter;
use Ramon\Canela\Events\EventsSettings;
use Ramon\Canela\Events\Recurrence;
use Tobyz\JsonApiServer\Context as OriginalContext;

use function Tobyz\JsonApiServer\json_api_response;

/**
 * `/api/canela-events`: os eventos (o `[event]` do primeiro post).
 *
 * - GET lista a agenda: os eventos com ocorrência entre `filter[from]` e
 *   `filter[to]` (AAAA-MM-DD; o padrão é de agora até um ano depois), cada um
 *   com as próprias ocorrências no intervalo (`occurrences`), em ordem, e a
 *   discussão incluída. `page[limit]` (até 200, padrão 50) conta ocorrências,
 *   e não eventos: um evento semanal ocupa uma vaga por semana. A página de
 *   eventos (lista e calendário) e o cartão "Próximos eventos" usam esta lista.
 * - GET /{id} devolve o cartão do evento, do ponto de vista de quem pede.
 * - POST /{id}/rsvp responde à presença (`status`: vou, interessado, não vou;
 *   null tira a resposta) e devolve o cartão atualizado.
 * - GET /{id}/invitees?filter[status]=going lista quem respondeu (até 200), como
 *   usuários só com o público, e as três contagens em `meta`.
 *
 * O evento só existe para quem vê a discussão, onde os eventos valem
 * (ScopeCalendarEventVisibility); para os outros, 404. Responder pede a
 * habilidade `rsvp` (CalendarEventPolicy). Desligado no admin, tudo é 404.
 * Os eventos nascem e mudam pelo post: o recurso não cria nem edita.
 *
 * @extends AbstractDatabaseResource<CalendarEvent>
 */
final class CalendarEventResource extends AbstractDatabaseResource
{
    public const DEFAULT_LIMIT = 50;

    public const MAX_LIMIT = 200;

    /** Teto de eventos lidos por pedido da agenda (os recorrentes multiplicam). */
    private const SCAN = 500;

    /** Teto de ocorrências de um evento recorrente num pedido da agenda. */
    private const OCCURRENCES = 62;

    private const INVITEES_LIMIT = 200;

    /** Onde o `query` do Index deixa a agenda pronta para o `results()`. */
    private const AGENDA = 'canela.events_agenda';

    /** O que a lista de convidados mostra de cada pessoa: só o público. */
    private const INVITEE_FIELDS = 'username,displayName,avatarUrl,slug';

    /** O resumo: sai na agenda e no cartão. */
    private const SUMMARY = ['name', 'startsAt', 'endsAt', 'ended', 'recurrence', 'timezone', 'going'];

    /** O resto do cartão (EventPresenter::full): só fora da agenda. */
    private const CARD = [
        'firstStartsAt', 'status', 'recurrenceUntil', 'url', 'location', 'description', 'maxAttendees',
        'chat', 'chatChannelId', 'interested', 'notGoing', 'full', 'myStatus', 'canRsvp', 'creator', 'sample',
    ];

    /**
     * O cartão de cada evento da resposta, montado uma vez: cada campo lê uma
     * chave dele, e o cartão inteiro consulta a resposta do ator e a amostra
     * de quem vai.
     *
     * @var \WeakMap<CalendarEvent, array<string, mixed>>
     */
    private \WeakMap $cards;

    public function __construct(
        private readonly EventsSettings $settings,
        private readonly EventPresenter $presenter,
        private readonly EventChat $chat,
        private readonly TranslatorInterface $translator,
        private readonly RsvpValidator $validator,
    ) {
        $this->cards = new \WeakMap();
    }

    #[\Override]
    public function type(): string
    {
        return 'canela-events';
    }

    #[\Override]
    public function model(): string
    {
        return CalendarEvent::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query->whereVisibleTo($context->getActor());
    }

    #[\Override]
    public function endpoints(): array
    {
        $assertEnabled = fn () => $this->assertEnabled();

        return [
            Endpoint\Index::make()
                ->before($assertEnabled)
                ->limit(self::DEFAULT_LIMIT)
                ->maxLimit(self::MAX_LIMIT)
                ->defaultInclude(['discussion'])
                ->query(function (Builder $query, mixed $pagination, Context $context, array $filters, ?array $sort, int $offset, ?int $limit): Context {
                    return $context->withQuery($query)->withInternal(self::AGENDA, $this->agenda($query, $filters, $limit ?? self::DEFAULT_LIMIT));
                }),
            Endpoint\Show::make()
                ->before($assertEnabled),
            Endpoint\Endpoint::make('rsvp')
                ->route('POST', '/{id}/rsvp')
                ->authenticated()
                ->action(fn (Context $context) => $this->rsvp($context)),
            Endpoint\Endpoint::make('invitees')
                ->route('GET', '/{id}/invitees')
                ->action(fn (Context $context) => $this->invitees($context))
                ->response(fn (Context $context, array $result) => $this->inviteesResponse($context, $result)),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        $fields = [];

        foreach (self::SUMMARY as $name) {
            $fields[] = Schema\Attribute::make($name)
                ->get(fn (CalendarEvent $event, Context $context) => $this->card($event, $context)[$name] ?? null);
        }

        foreach (self::CARD as $name) {
            $fields[] = Schema\Attribute::make($name)
                ->visible(static fn (CalendarEvent $event, Context $context) => ! $context->listing(self::class))
                ->get(fn (CalendarEvent $event, Context $context) => $this->card($event, $context)[$name] ?? null);
        }

        // Na agenda: as ocorrências do intervalo pedido, em ordem.
        $fields[] = Schema\Arr::make('occurrences')
            ->visible(static fn (CalendarEvent $event, Context $context) => $context->listing(self::class))
            ->get(static fn (CalendarEvent $event) => $event->agendaOccurrences ?? []);

        $fields[] = Schema\Relationship\ToOne::make('discussion')
            ->type('discussions')
            ->includable();

        return $fields;
    }

    /** A agenda já vem em ordem, montada no `query` do Index. */
    #[\Override]
    public function results(object $query, OriginalContext $context): iterable
    {
        $agenda = $context instanceof Context ? $context->internal(self::AGENDA) : null;

        return is_array($agenda) ? $agenda : parent::results($query, $context);
    }

    /** A agenda conta ocorrências, e não linhas: sem `meta.page.total`. */
    #[\Override]
    public function count(object $query, OriginalContext $context): ?int
    {
        return $context instanceof Context && is_array($context->internal(self::AGENDA)) ? null : parent::count($query, $context);
    }

    private function assertEnabled(): void
    {
        if (! $this->settings->enabled()) {
            throw new RouteNotFoundException();
        }
    }

    /** @return array<string, mixed> */
    private function card(CalendarEvent $event, Context $context): array
    {
        return $this->cards[$event] ??= $context->listing(self::class)
            ? [...$this->presenter->summary($event), 'going' => $event->going_count]
            : $this->presenter->full($event, $context->getActor());
    }

    /**
     * As ocorrências entre as duas datas, das discussões que o ator vê (o
     * escopo do recurso já está na consulta), sem os eventos cujo primeiro
     * post a moderação ocultou.
     *
     * @param Builder<CalendarEvent> $query
     * @param array<string, mixed> $filters
     * @return list<CalendarEvent>
     */
    private function agenda(Builder $query, array $filters, int $limit): array
    {
        $now = Carbon::now();
        $from = self::date($filters['from'] ?? null) ?? $now->copy();
        $to = self::date($filters['to'] ?? null)?->endOfDay() ?? $from->copy()->addYear();
        $limit = max(1, min(self::MAX_LIMIT, $limit));

        if ($to->lessThan($from) || $from->diffInDays($to) > 400) {
            $to = $from->copy()->addYear();
        }

        $events = $query
            ->whereHas('post', static fn ($post) => $post->whereNull('hidden_at'))
            ->where(static function ($q) use ($from, $to) {
                // Os únicos que caem no intervalo, e os recorrentes que começaram
                // antes do fim dele e ainda não terminaram.
                $q->where(static fn ($single) => $single->whereNull('recurrence')
                    ->where('starts_at', '<=', $to)
                    ->where(static fn ($end) => $end->where('ends_at', '>=', $from)->orWhere(static fn ($noEnd) => $noEnd->whereNull('ends_at')->where('starts_at', '>=', $from->copy()->subHour()))))
                    ->orWhere(static fn ($recurring) => $recurring->whereNotNull('recurrence')
                        ->where('starts_at', '<=', $to)
                        ->where(static fn ($until) => $until->whereNull('recurrence_until')->orWhere('recurrence_until', '>=', $from)));
            })
            ->orderBy('starts_at')
            ->limit(self::SCAN)
            ->get();

        $items = [];

        foreach ($events as $event) {
            // O orderBy/limit do construtor apagam o tipo da coleção.
            if (! $event instanceof CalendarEvent) {
                continue;
            }

            foreach (Recurrence::upcoming($event, $from, $to, self::OCCURRENCES) as [$start, $end]) {
                $items[] = [$event, $start->toIso8601String(), $event->ends_at ? $end->toIso8601String() : null];
            }
        }

        usort($items, static fn (array $a, array $b): int => strcmp($a[1], $b[1]));

        // Os eventos na ordem da primeira ocorrência que coube no limite.
        $ordered = [];

        foreach (array_slice($items, 0, $limit) as [$event, $startsAt, $endsAt]) {
            $ordered[$event->id] ??= $event;
            $event->agendaOccurrences ??= [];
            $event->agendaOccurrences[] = ['startsAt' => $startsAt, 'endsAt' => $endsAt];
        }

        return array_values($ordered);
    }

    private function rsvp(Context $context): CalendarEvent
    {
        $this->assertEnabled();

        /** @var CalendarEvent $event */
        $event = $context->model;
        $actor = $context->getActor();

        // O "standalone" é só o aviso, e o evento que a moderação ocultou não
        // aceita resposta: para quem tenta, ele não tem presença (404).
        if (! $event->hasRsvp() || ! $event->post || $event->post->hidden_at !== null) {
            throw new RouteNotFoundException();
        }

        $actor->assertCan('rsvp', $event);

        $status = Arr::get($context->body() ?? [], 'data.attributes.status');
        $this->validator->assertValid(['status' => $status]);

        $this->save($event, $actor, is_string($status) ? $status : null);

        if ($status === EventInvitee::GOING) {
            $this->chat->join($event, $actor);
        }

        return $event;
    }

    /**
     * Numa transação com a linha do evento travada: dois "vou" ao mesmo tempo
     * na última vaga leriam a mesma contagem e lotariam o evento.
     */
    private function save(CalendarEvent $event, User $actor, ?string $status): void
    {
        $event->getConnection()->transaction(function () use ($event, $actor, $status): void {
            /** @var CalendarEvent $locked */
            $locked = CalendarEvent::query()->whereKey($event->id)->lockForUpdate()->firstOrFail();
            $locked->refreshCounts();

            /** @var EventInvitee|null $invitee */
            $invitee = EventInvitee::query()->where('event_id', $event->id)->where('user_id', $actor->id)->first();

            // Vagas: só o "vou" conta, e quem já ia não perde a vaga ao responder de novo.
            if ($status === EventInvitee::GOING && $locked->max_attendees !== null && $invitee?->status !== EventInvitee::GOING
                && $locked->going_count >= $locked->max_attendees) {
                throw new ValidationException(['status' => $this->translator->trans('ramon-canela.api.events.full')]);
            }

            if ($status === null) {
                $invitee?->delete();
            } else {
                $invitee ??= new EventInvitee();
                $invitee->event_id = $event->id;
                $invitee->user_id = (int) $actor->id;
                $invitee->status = $status;
                $invitee->save();
            }

            $event->refreshCounts();
            $event->save();
        });
    }

    /**
     * Quem respondeu com o status pedido (um status desconhecido vira "vou").
     *
     * @return array{event: CalendarEvent, status: string, users: list<User>}
     */
    private function invitees(Context $context): array
    {
        $this->assertEnabled();

        /** @var CalendarEvent $event */
        $event = $context->model;
        $status = Arr::get($context->request->getQueryParams(), 'filter.status', EventInvitee::GOING);

        if (! is_string($status) || ! in_array($status, EventInvitee::STATUSES, true)) {
            $status = EventInvitee::GOING;
        }

        $users = [];

        $invitees = EventInvitee::query()
            ->where('event_id', $event->id)
            ->where('status', $status)
            ->with('user')
            ->orderBy('created_at')
            ->limit(self::INVITEES_LIMIT)
            ->get();

        foreach ($invitees as $invitee) {
            // O orderBy/limit do construtor apagam o tipo da coleção: a checagem fica aqui.
            if ($invitee instanceof EventInvitee && $invitee->user instanceof User) {
                $users[] = $invitee->user;
            }
        }

        return ['event' => $event, 'status' => $status, 'users' => $users];
    }

    /**
     * As pessoas como recursos `users`, só com os campos públicos (os campos
     * esparsos valem sempre: a lista chega a 200 pessoas, e nada além do nome
     * e do avatar aparece nela).
     *
     * @param array{event: CalendarEvent, status: string, users: list<User>} $result
     */
    private function inviteesResponse(Context $context, array $result): ResponseInterface
    {
        $request = $context->request;
        $context = $context->withRequest($request->withQueryParams([
            ...$request->getQueryParams(),
            'fields' => ['users' => self::INVITEE_FIELDS],
        ]));

        $serializer = new Serializer($context);
        $users = $context->resource('users');

        foreach ($result['users'] as $user) {
            $serializer->addPrimary($users, $user, []);
        }

        [$data] = $serializer->serialize();
        $event = $result['event'];

        return json_api_response([
            'data' => $data,
            'meta' => [
                'status' => $result['status'],
                'counts' => [
                    EventInvitee::GOING => $event->going_count,
                    EventInvitee::INTERESTED => $event->interested_count,
                    EventInvitee::NOT_GOING => $event->not_going_count,
                ],
            ],
        ]);
    }

    private static function date(mixed $value): ?Carbon
    {
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return null;
        }

        try {
            return Carbon::createFromFormat('Y-m-d', $value, 'UTC')?->startOfDay();
        } catch (\Throwable) {
            return null;
        }
    }
}
