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

namespace Ramon\Canela\Push\Http;

use Flarum\Http\RequestUtil;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Push\Push;
use Ramon\Canela\Push\PushSubscription;

/**
 * POST grava o aparelho do ator (o objeto do PushManager.subscribe());
 * DELETE apaga pelo endpoint. Só o próprio aparelho: o endpoint é o que
 * identifica, e mudar de conta no mesmo navegador passa o aparelho adiante.
 */
final class SubscriptionController implements RequestHandlerInterface
{
    public function __construct(
        private readonly Push $push,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $body = (array) $request->getParsedBody();
        $endpoint = (string) Arr::get($body, 'endpoint');

        if (! str_starts_with($endpoint, 'https://') || strlen($endpoint) > 2000) {
            return new EmptyResponse(422);
        }

        $hash = hash('sha256', $endpoint);

        if ($request->getMethod() === 'DELETE') {
            PushSubscription::query()->where('endpoint_hash', $hash)->where('user_id', $actor->id)->delete();

            return new EmptyResponse(204);
        }

        if (! $this->push->enabled()) {
            return new EmptyResponse(403);
        }

        $key = (string) Arr::get($body, 'keys.p256dh');
        $auth = (string) Arr::get($body, 'keys.auth');

        if ($key === '' || $auth === '' || strlen($key) > 255 || strlen($auth) > 255) {
            return new EmptyResponse(422);
        }

        PushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => $hash],
            ['user_id' => $actor->id, 'endpoint' => $endpoint, 'public_key' => $key, 'auth_token' => $auth],
        );

        return new EmptyResponse(204);
    }
}
