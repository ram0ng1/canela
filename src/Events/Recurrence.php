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
use Carbon\CarbonInterface;

/**
 * A ocorrência de agora de um evento: a que está acontecendo ou a próxima.
 *
 * A conta é feita no fuso de quem criou o evento: "toda quinta às 10h" continua
 * às 10h depois da mudança do horário de verão, e o "todo mês" é o mesmo dia da
 * semana na mesma posição do mês ("a segunda quinta").
 */
final class Recurrence
{
    /** Sem fim marcado, o evento conta como acontecendo por uma hora. */
    private const DEFAULT_MINUTES = 60;

    /** Teto de passos da conta (um evento diário de 30 anos cabe com folga). */
    private const MAX_STEPS = 12000;

    /** Dias de cada recorrência de período fixo. */
    private const FIXED_DAYS = [
        'every_day' => 1,
        'every_week' => 7,
        'every_two_weeks' => 14,
        'every_four_weeks' => 28,
    ];

    /**
     * [início, fim, terminou] da ocorrência de agora. Sem recorrência, a única;
     * com ela, a que ainda não acabou — ou a última, marcada como terminada,
     * quando o "até" já passou.
     *
     * @return array{0: Carbon, 1: Carbon, 2: bool}
     */
    public static function current(CalendarEvent $event, ?CarbonInterface $now = null): array
    {
        $now = $now ? Carbon::instance($now) : Carbon::now();
        $start = $event->starts_at->copy()->utc();
        $duration = $event->ends_at && $event->ends_at->greaterThan($start)
            ? (int) $start->diffInSeconds($event->ends_at)
            : self::DEFAULT_MINUTES * 60;
        $end = static fn (Carbon $from): Carbon => $from->copy()->addSeconds($duration);

        if (! $event->recurrence || ! self::valid($event->recurrence)) {
            return [$start, $end($start), $end($start)->lessThanOrEqualTo($now)];
        }

        $zone = self::zone($event->timezone);
        $local = $start->copy()->setTimezone($zone);
        $until = $event->recurrence_until?->copy()->setTimezone($zone)->endOfDay();
        $last = $local->copy();

        // Os períodos fixos pulam direto para perto de agora.
        if (isset(self::FIXED_DAYS[$event->recurrence])) {
            $days = self::FIXED_DAYS[$event->recurrence];
            $elapsed = (int) floor($local->diffInDays($now->copy()->setTimezone($zone), false));
            $skip = max(0, intdiv($elapsed, $days) - 1);

            if ($skip > 0) {
                $local->addDays($skip * $days);
            }
        }

        for ($step = 0; $step < self::MAX_STEPS; $step++) {
            if ($until && $local->greaterThan($until)) {
                $utc = $last->copy()->utc();

                return [$utc, $end($utc), true];
            }

            $utc = $local->copy()->utc();

            if ($end($utc)->greaterThan($now)) {
                return [$utc, $end($utc), false];
            }

            $last = $local->copy();
            $local = self::next($local, $event->recurrence, $start->copy()->setTimezone($zone));
        }

        $utc = $last->copy()->utc();

        return [$utc, $end($utc), true];
    }

    /**
     * As ocorrências entre `$from` e `$to` (para o calendário), em UTC.
     *
     * @return list<array{0: Carbon, 1: Carbon}>
     */
    public static function upcoming(CalendarEvent $event, CarbonInterface $from, CarbonInterface $to, int $limit = 31): array
    {
        [$start, $end, $ended] = self::current($event, $from);
        $occurrences = [];

        if ($ended) {
            return $occurrences;
        }

        $duration = (int) $start->diffInSeconds($end);
        $zone = self::zone($event->timezone);
        $local = $start->copy()->setTimezone($zone);
        $origin = $event->starts_at->copy()->setTimezone($zone);
        $until = $event->recurrence_until?->copy()->setTimezone($zone)->endOfDay();

        while (count($occurrences) < $limit && $local->lessThanOrEqualTo($to)) {
            if ($until && $local->greaterThan($until)) {
                break;
            }

            $utc = $local->copy()->utc();
            $occurrences[] = [$utc, $utc->copy()->addSeconds($duration)];

            if (! $event->recurrence || ! self::valid($event->recurrence)) {
                break;
            }

            $local = self::next($local, $event->recurrence, $origin);
        }

        return $occurrences;
    }

    public static function valid(string $rule): bool
    {
        return in_array($rule, Formatter\EventTag::RECURRENCES, true);
    }

    private static function zone(?string $timezone): string
    {
        if ($timezone && in_array($timezone, \DateTimeZone::listIdentifiers(), true)) {
            return $timezone;
        }

        return 'UTC';
    }

    private static function next(Carbon $current, string $rule, Carbon $origin): Carbon
    {
        $next = $current->copy();

        switch ($rule) {
            case 'every_weekday':
                do {
                    $next->addDay();
                } while ($next->isWeekend());

                return $next;
            case 'every_month':
                return self::nextMonthly($current, $origin);
            default:
                return $next->addDays(self::FIXED_DAYS[$rule] ?? 7);
        }
    }

    /**
     * O mesmo dia da semana na mesma posição do mês seguinte ("a segunda
     * quinta"); a quinta ocorrência que não existe vira a última do mês.
     */
    private static function nextMonthly(Carbon $current, Carbon $origin): Carbon
    {
        $weekday = $origin->dayOfWeek;
        $position = (int) ceil($origin->day / 7);
        $month = $current->copy()->startOfMonth()->addMonthNoOverflow();
        $first = $month->copy();

        while ($first->dayOfWeek !== $weekday) {
            $first->addDay();
        }

        $target = $first->copy()->addWeeks($position - 1);

        if ($target->month !== $month->month) {
            $target->subWeek();
        }

        return $target->setTime($origin->hour, $origin->minute, $origin->second);
    }
}
