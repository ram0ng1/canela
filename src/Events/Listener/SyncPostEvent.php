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

namespace Ramon\Canela\Events\Listener;

use Flarum\Post\CommentPost;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Psr\Log\LoggerInterface;
use Ramon\Canela\Events\Api\EventBuffer;
use Ramon\Canela\Events\CalendarEvent;
use Ramon\Canela\Events\EventChat;
use Ramon\Canela\Events\EventsSettings;
use Ramon\Canela\Events\EventXml;

/**
 * O `[event]` do primeiro post vira (ou atualiza, ou apaga) a linha do evento.
 *
 * Só o primeiro post tem evento. Mudar a data de início
 * zera o lembrete enviado; mudar só o resto mantém as respostas de presença.
 * Um erro aqui fica no log: o post já foi salvo e não pode virar um 500.
 */
final class SyncPostEvent
{
    public function __construct(
        private readonly EventsSettings $settings,
        private readonly EventChat $chat,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function __invoke(Posted|Revised $event): void
    {
        $post = $event->post;

        if ((int) $post->number !== 1 || ! $this->settings->enabled()) {
            return;
        }

        try {
            $this->sync($post);
        } catch (\Throwable $error) {
            $this->logger->warning('[ramon/canela] evento do post '.$post->id.' não sincronizado: '.$error->getMessage());
        }
    }

    private function sync(CommentPost $post): void
    {
        $data = EventXml::read($post->getParsedContentAttribute());
        /** @var CalendarEvent|null $existing */
        $existing = CalendarEvent::query()->where('post_id', $post->id)->first();

        // Fora da tag dos eventos o `[event]` é só texto: nem evento nem canal.
        if ($data === null || ! $post->discussion || ! $this->settings->appliesTo($post->discussion)) {
            $existing?->delete();
            EventBuffer::flush();

            return;
        }

        $calendarEvent = $existing ?? new CalendarEvent();

        if ($existing && ! $existing->starts_at->equalTo($data['starts_at'])) {
            $calendarEvent->reminded_start = null;
        }

        $calendarEvent->post_id = $post->id;
        $calendarEvent->discussion_id = $post->discussion_id;
        $calendarEvent->user_id ??= $post->user_id;

        foreach ($data as $column => $value) {
            $calendarEvent->setAttribute($column, $value);
        }

        $calendarEvent->save();
        // A resposta desta mesma requisição já vê o evento gravado.
        EventBuffer::flush();

        $calendarEvent->setRelation('discussion', $post->discussion);
        $this->chat->ensureChannel($calendarEvent, $post->user);
    }
}
