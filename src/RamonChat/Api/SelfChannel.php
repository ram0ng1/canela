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

namespace Ramon\Canela\RamonChat\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Events\Dispatcher;
use Laminas\Diactoros\Response\JsonResponse;
use Ramon\Canela\RamonChat\RamonChatSettings;
use Ramon\Chat\Channel;
use Ramon\Chat\ChannelUser;
use Ramon\Chat\Event\ChannelWasCreated;
use Ramon\Chat\Service\MembershipManager;

/**
 * `POST /api/chat-channels/canela-self`: a MD consigo mesmo ("Anotar algo"),
 * um endpoint de ação no recurso de canais do ramon/chat. O `/chat/direct`
 * dele recusa uma lista só com o próprio ator; aqui o canal direto é achado
 * (o que só tem o ator) ou criado, pelo MembershipManager dele.
 *
 * Só para quem entrou (401), com o recurso ligado e a permissão de começar
 * MDs do ramon/chat (`startDirect`, 403). 201 quando cria, 200 quando acha.
 */
final class SelfChannel
{
    public function __construct(
        private readonly MembershipManager $memberships,
        private readonly Dispatcher $events,
        private readonly RamonChatSettings $settings,
    ) {
    }

    public static function endpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.self')
            ->route('POST', '/canela-self')
            ->authenticated()
            ->action(static fn (Context $context): array => resolve(self::class)->open($context))
            ->response(static fn (Context $context, array $result): JsonResponse => new JsonResponse(
                ChannelDocument::make($context->request, (int) $result['channel']->id, $result['created']),
                $result['created'] ? 201 : 200
            ));
    }

    /** @return array{channel: Channel, created: bool} */
    public function open(Context $context): array
    {
        $actor = $context->getActor();

        if (! $this->settings->enabled('self_dm') || ! $actor->can('startDirect')) {
            throw new PermissionDeniedException();
        }

        $channel = $this->existing((int) $actor->id);

        if ($channel !== null) {
            // Idempotente: se o ator tinha saído, volta.
            $this->memberships->join($channel, $actor);

            return ['channel' => $channel, 'created' => false];
        }

        $channel = Channel::query()->getConnection()->transaction(function () use ($actor): Channel {
            $channel = Channel::build(Channel::TYPE_DIRECT, creator: $actor);
            $channel->save();

            $this->memberships->join($channel, $actor);
            $channel->refreshMetadata()->save();

            return $channel;
        });

        $this->events->dispatch(new ChannelWasCreated($channel, $actor));

        return ['channel' => $channel, 'created' => true];
    }

    /** A MD em que o ator é o único participante (e que nunca teve outro). */
    private function existing(int $actorId): ?Channel
    {
        $mine = ChannelUser::query()->where('user_id', $actorId)->select('channel_id');

        /** @var Channel|null */
        return Channel::query()
            ->whereIn('id', $mine)
            ->where('type', Channel::TYPE_DIRECT)
            ->whereNull('deleted_at')
            ->whereNotExists(
                static fn ($sub) => $sub->from('chat_channel_user')
                    ->whereColumn('chat_channel_user.channel_id', 'chat_channels.id')
                    ->where('chat_channel_user.user_id', '!=', $actorId)
            )
            ->orderBy('id')
            ->first();
    }
}
