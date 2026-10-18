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
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\RamonChat\RamonChatSettings;
use Ramon\Canela\RamonChat\TypingStore;
use Ramon\Chat\ChannelUser;

/**
 * `GET /api/canela-ramon-chat/channels/{id}/typing`: quem está digitando no
 * canal, para o fórum sem flarum/realtime (o JS pergunta a cada poucos
 * segundos com o canal aberto). Só para quem participa do canal — uma
 * consulta indexada, em vez da visibilidade inteira a cada poucos segundos.
 */
final class TypingController implements RequestHandlerInterface
{
    public function __construct(
        private readonly TypingStore $typing,
        private readonly RamonChatSettings $settings,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $channelId = (int) Arr::get($request->getQueryParams(), 'id');

        if ($actor->isGuest() || ! $this->settings->enabled('typing_poll')) {
            throw new PermissionDeniedException();
        }

        $member = ChannelUser::query()
            ->where('channel_id', $channelId)
            ->where('user_id', $actor->id)
            ->whereNull('left_at')
            ->exists();

        return new JsonResponse(['data' => $member ? $this->typing->typists($channelId, (int) $actor->id) : []]);
    }
}
