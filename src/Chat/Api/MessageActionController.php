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
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * As ações sobre uma mensagem, pelo último pedaço do caminho:
 *
 * - `POST /api/chat/messages/{id}/restore`: "Restaurar mensagem excluída".
 * - `POST /api/chat/messages/{id}/reactions`: `{emoji, action: add|remove}`.
 * - `POST|DELETE /api/chat/messages/{id}/pin`: fixar e desafixar.
 */
final class MessageActionController extends AbstractChatController
{
    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array|ResponseInterface|null
    {
        [$message, $channel] = $this->message($request, $actor);
        $action = (string) ($request->getQueryParams()['action'] ?? '');
        $body = $this->body($request);

        match ($action) {
            'restore' => $this->service->restoreMessage($message, $channel, $actor),
            'reactions' => $this->service->react($message, $channel, $actor, (string) ($body['emoji'] ?? ''), ($body['action'] ?? 'add') !== 'remove'),
            'pin' => $this->service->pin($message, $channel, $actor, $method !== 'DELETE'),
            default => throw new ModelNotFoundException(),
        };

        return $this->presentMessage($message, $channel, $actor);
    }
}
