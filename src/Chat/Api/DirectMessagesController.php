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

namespace Ramon\Canela\Chat\Api;

use Flarum\User\User;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * `POST /api/chat/direct-messages`: abre (ou reabre) a MD com `userIds`, com o
 * `name` opcional do chat em grupo.
 */
final class DirectMessagesController extends AbstractChatController
{
    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array
    {
        $body = $this->body($request);
        $channel = $this->service->openDirect($actor, array_map('intval', (array) ($body['userIds'] ?? [])), isset($body['name']) ? (string) $body['name'] : null);

        return $this->presentChannel($channel, $actor);
    }
}
