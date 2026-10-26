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
 * `/api/chat/messages/{id}`: GET uma mensagem (o "copiar link" e a resposta
 * citada que não está na tela), PATCH edita (`message`, `uploadIds`), DELETE
 * apaga.
 */
final class MessageController extends AbstractChatController
{
    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): array
    {
        [$message, $channel] = $this->message($request, $actor);

        if ($method === 'PATCH') {
            $body = $this->body($request);
            $uploadIds = array_key_exists('uploadIds', $body) ? array_map('intval', (array) $body['uploadIds']) : null;

            $this->service->updateMessage($message, $channel, $actor, (string) ($body['message'] ?? ''), $uploadIds);
        }

        if ($method === 'DELETE') {
            $this->service->deleteMessage($message, $channel, $actor);
        }

        return $this->presentMessage($message, $channel, $actor);
    }
}
