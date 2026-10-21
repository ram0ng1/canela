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

use Flarum\Http\RequestUtil;
use Flarum\User\Exception\NotAuthenticatedException;
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Contracts\Events\Dispatcher;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\RamonChat\RamonChatSettings;
use Ramon\Chat\Channel;
use Ramon\Chat\ChannelUser;
use Ramon\Chat\Event\ChannelWasCreated;
use Ramon\Chat\Service\MembershipManager;

/**
 * `POST /api/canela-ramon-chat/self`: a MD consigo mesmo
 * ("Anotar algo"). O `/chat/direct` do ramon/chat recusa uma lista só com o
 * próprio ator; aqui o canal direto é achado (o que só tem o ator) ou criado,
 * pelo MembershipManager dele.
 */
final class SelfChannelController implements RequestHandlerInterface
{
    public function __construct(
        private readonly MembershipManager $memberships,
        private readonly Dispatcher $events,
        private readonly RamonChatSettings $settings,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);

        if ($actor->isGuest()) {
            throw new NotAuthenticatedException();
        }

        if (! $this->settings->enabled('self_dm') || ! $actor->can('startDirect')) {
            throw new PermissionDeniedException();
        }

        $channel = $this->existing((int) $actor->id);
        $created = false;

        if ($channel === null) {
            $channel = Channel::query()->getConnection()->transaction(function () use ($actor): Channel {
                $channel = Channel::build(Channel::TYPE_DIRECT, creator: $actor);
                $channel->save();

                $this->memberships->join($channel, $actor);
                $channel->refreshMetadata()->save();

                return $channel;
            });

            $created = true;
            $this->events->dispatch(new ChannelWasCreated($channel, $actor));
        } else {
            // Idempotente: se o ator tinha saído, volta.
            $this->memberships->join($channel, $actor);
        }

        return new JsonResponse(ChannelDocument::make($request, (int) $channel->id, $created), $created ? 201 : 200);
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
