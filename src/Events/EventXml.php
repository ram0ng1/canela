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
use Ramon\Canela\Events\Formatter\EventTag;

/**
 * Lê o `[event]` do XML do post (o conteúdo já analisado pelo formatador): os
 * atributos já passaram pelos filtros do BBCode, então aqui só se converte cada
 * um para a coluna dele. O primeiro [event] do post é o que vale.
 */
final class EventXml
{
    /**
     * Os dados do evento, ou null quando o post não tem [event] (ou tem um com
     * data que não fecha).
     *
     * @return array<string, mixed>|null
     */
    public static function read(?string $xml): ?array
    {
        if (! $xml || ! str_contains($xml, '<'.EventTag::NAME.' ')) {
            return null;
        }

        $document = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($xml, LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        if (! $loaded) {
            return null;
        }

        $element = $document->getElementsByTagName(EventTag::NAME)->item(0);

        if (! $element instanceof \DOMElement) {
            return null;
        }

        $attr = static fn (string $name): ?string => $element->hasAttribute($name) && trim($element->getAttribute($name)) !== ''
            ? trim($element->getAttribute($name))
            : null;

        $timezone = $attr('timezone');

        if ($timezone !== null && ! in_array($timezone, \DateTimeZone::listIdentifiers(), true)) {
            $timezone = null;
        }

        $start = self::date($attr('start'), $timezone);

        if (! $start) {
            return null;
        }

        $end = self::date($attr('end'), $timezone);

        if ($end && $end->lessThanOrEqualTo($start)) {
            $end = null;
        }

        $until = $attr('until');
        $max = $attr('max');

        return [
            'name' => self::limit($attr('name'), 200),
            'starts_at' => $start,
            'ends_at' => $end,
            'timezone' => $timezone,
            'status' => in_array($attr('status'), EventTag::STATUSES, true) ? $attr('status') : CalendarEvent::STATUS_PUBLIC,
            'recurrence' => in_array($attr('recurrence'), EventTag::RECURRENCES, true) ? $attr('recurrence') : null,
            'recurrence_until' => $until ? self::date($until, $timezone)?->endOfDay() : null,
            'url' => self::limit($attr('url'), 1000),
            'location' => self::limit($attr('location'), 255),
            'description' => self::limit(self::description($element), 2000),
            'max_attendees' => $max !== null && (int) $max > 0 ? min((int) $max, 1000000) : null,
            'chat_enabled' => $attr('chat') === 'true',
        ];
    }

    /** "2026-10-30 10:00" no fuso do evento, em UTC. */
    private static function date(?string $value, ?string $timezone): ?Carbon
    {
        if ($value === null || ! preg_match('/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{1,2}):(\d{2}))?$/', $value, $match)) {
            return null;
        }

        try {
            $date = Carbon::createFromFormat('Y-m-d H:i', $match[1].' '.sprintf('%02d:%02d', (int) ($match[2] ?? 0), (int) ($match[3] ?? 0)), $timezone ?: 'UTC');
        } catch (\Throwable) {
            return null;
        }

        return $date ? $date->utc() : null;
    }

    /** O texto da descrição, sem as marcas do BBCode e do markdown. */
    private static function description(\DOMElement $element): ?string
    {
        $text = '';

        foreach ($element->childNodes as $child) {
            // <s> e <e> guardam o código de abertura e de fechamento.
            if ($child instanceof \DOMElement && in_array($child->nodeName, ['s', 'e'], true)) {
                continue;
            }

            $text .= self::plain($child);
        }

        $text = trim(preg_replace('/[ \t]+/', ' ', preg_replace('/\n{3,}/', "\n\n", $text) ?? '') ?? '');

        return $text === '' ? null : $text;
    }

    /** O texto de um nó sem as marcas do markdown (<s>/<e> dentro de cada tag). */
    private static function plain(\DOMNode $node): string
    {
        if ($node instanceof \DOMText) {
            return $node->wholeText;
        }

        if ($node instanceof \DOMElement && in_array($node->nodeName, ['s', 'e', 'i'], true)) {
            return '';
        }

        $text = '';

        foreach ($node->childNodes as $child) {
            $text .= self::plain($child);
        }

        return $text;
    }

    private static function limit(?string $value, int $length): ?string
    {
        return $value === null ? null : mb_substr($value, 0, $length);
    }
}
