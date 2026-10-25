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

use Flarum\User\User;
use Illuminate\Contracts\Events\Dispatcher;
use Psr\Log\LoggerInterface;
use Ramon\Chat\Channel;
use Ramon\Chat\Event\ChannelWasCreated;
use Ramon\Chat\Service\MembershipManager;

/**
 * O canal de chat do evento, no ramon/chat: criado junto com o evento que pede chat, preso à tag da
 * discussão (a visibilidade do canal é a da tag) e com o nome do evento. Quem
 * marca "Vou" entra no canal; o fórum mostra o canal ao lado do tópico.
 *
 * As classes do ramon/chat só são tocadas depois de EventsSettings::chatAvailable():
 * sem a extensão, nada daqui roda. Uma falha do chat não derruba o post: o
 * evento continua sem canal, e o erro vai para o log.
 */
final class EventChat
{
    public function __construct(
        private readonly EventsSettings $settings,
        private readonly Dispatcher $events,
        private readonly LoggerInterface $logger,
    ) {
    }

    /** Cria o canal do evento, se ele pede chat e ainda não tem. */
    public function ensureChannel(CalendarEvent $event, ?User $creator): void
    {
        if (! $event->chat_enabled || ! $this->settings->chatAvailable()) {
            return;
        }

        try {
            if ($event->chat_channel_id && Channel::query()->whereKey($event->chat_channel_id)->exists()) {
                $this->rename($event);

                return;
            }

            $discussion = $event->discussion;
            $tagId = $this->settings->tagId();

            if ($tagId === null && $discussion && method_exists($discussion, 'tags')) {
                $tagId = $discussion->tags()->orderByRaw('position is null')->value('tags.id');
            }

            $name = $this->channelName($event);
            $channel = Channel::build(Channel::TYPE_CATEGORY, $name, null, $tagId ? (int) $tagId : null, $creator);
            $channel->is_private = false;
            $channel->post_permission = Channel::POST_ALL;
            $channel->auto_join = false;
            $channel->auto_join_on_reply = false;
            $channel->post_discussions = false;
            $channel->allow_channel_wide_mentions = false;
            $channel->threading_enabled = false;
            $channel->messages_count = 0;
            $channel->user_count = 0;
            $channel->save();

            if ($creator && $creator->exists) {
                resolve(MembershipManager::class)->join($channel, $creator);
            }

            $channel->refreshMetadata()->save();
            $this->events->dispatch(new ChannelWasCreated($channel, $creator));

            $event->chat_channel_id = $channel->id;
            $event->save();
        } catch (\Throwable $error) {
            $this->logger->warning('[ramon/canela] canal do evento não criado: '.$error->getMessage());
        }
    }

    /** Quem vai ao evento entra no canal dele. */
    public function join(CalendarEvent $event, User $user): void
    {
        if (! $event->chat_channel_id || ! $this->settings->chatAvailable()) {
            return;
        }

        try {
            $channel = Channel::query()->find($event->chat_channel_id);

            if ($channel && $user->can('join', $channel)) {
                resolve(MembershipManager::class)->join($channel, $user);
            }
        } catch (\Throwable $error) {
            $this->logger->warning('[ramon/canela] entrada no canal do evento falhou: '.$error->getMessage());
        }
    }

    /** O canal segue o nome do evento quando ele muda. */
    private function rename(CalendarEvent $event): void
    {
        $channel = Channel::query()->find($event->chat_channel_id);
        $name = $this->channelName($event);

        if ($channel && $channel->name !== $name) {
            $channel->name = $name;
            $channel->save();
        }
    }

    private function channelName(CalendarEvent $event): string
    {
        $name = $event->name ?: ($event->discussion?->title ?: 'Evento');

        return mb_substr($name, 0, 100);
    }
}
