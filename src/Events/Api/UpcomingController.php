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
use Flarum\Discussion\Discussion;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Events\CalendarEvent;
use Ramon\Canela\Events\EventsSettings;
use Ramon\Canela\Events\Recurrence;

/**
 * GET /api/canela-events?from=2026-10-01&to=2026-11-30&limit=50
 *
 * As ocorrências dos eventos entre duas datas (o padrão é de agora até um ano
 * depois), em ordem: a página de eventos (lista e calendário) e o cartão
 * "Próximos eventos". Cada evento recorrente aparece uma vez por ocorrência.
 * Só os das discussões que o leitor vê, onde os eventos valem.
 */
final class UpcomingController implements RequestHandlerInterface
{
    private const MAX_LIMIT = 200;

    /** Teto de eventos lidos por pedido (os recorrentes multiplicam). */
    private const SCAN = 500;

    public function __construct(
        private readonly EventsSettings $settings,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->enabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $query = $request->getQueryParams();
        $now = Carbon::now();
        $from = $this->date(Arr::get($query, 'from')) ?? $now->copy();
        $to = $this->date(Arr::get($query, 'to'))?->endOfDay() ?? $from->copy()->addYear();
        $limit = max(1, min(self::MAX_LIMIT, (int) Arr::get($query, 'limit', 50)));

        if ($to->lessThan($from) || $from->diffInDays($to) > 400) {
            $to = $from->copy()->addYear();
        }

        $visible = Discussion::whereVisibleTo($actor)->select('discussions.id');
        $tagId = $this->settings->tagId();

        if ($tagId !== null) {
            $visible->whereIn('discussions.id', static fn ($sub) => $sub->select('discussion_id')->from('discussion_tag')->where('tag_id', $tagId));
        }

        $events = CalendarEvent::query()
            ->with('discussion')
            ->whereIn('discussion_id', $visible)
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

            $discussion = $event->discussion;
            $title = $discussion instanceof Discussion ? (string) $discussion->title : null;
            $slug = $discussion instanceof Discussion ? (string) $discussion->slug : null;

            foreach (Recurrence::upcoming($event, $from, $to, 62) as [$start, $end]) {
                $items[] = $this->item($event, $start, $end, $title, $slug);
            }
        }

        usort($items, static fn (array $a, array $b): int => strcmp($a['startsAt'], $b['startsAt']));

        return new JsonResponse(['events' => array_slice($items, 0, $limit)]);
    }

    /**
     * Uma ocorrência na resposta.
     *
     * @return array{id: int, name: string|null, startsAt: string, endsAt: string|null, recurrence: string|null, timezone: string|null, going: int, discussion: array{id: string, title: string|null, slug: string|null}}
     */
    private function item(CalendarEvent $event, Carbon $start, Carbon $end, ?string $title, ?string $slug): array
    {
        return [
            'id' => $event->id,
            'name' => $event->name ?: $title,
            'startsAt' => $start->toIso8601String(),
            'endsAt' => $event->ends_at ? $end->toIso8601String() : null,
            'recurrence' => $event->recurrence,
            'timezone' => $event->timezone,
            'going' => $event->going_count,
            'discussion' => [
                'id' => (string) $event->discussion_id,
                'title' => $title,
                'slug' => $slug,
            ],
        ];
    }

    private function date(mixed $value): ?Carbon
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
