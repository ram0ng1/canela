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
 * `/api/chat/channels/{id}`: GET mostra, PATCH edita (nome, descrição, slug,
 * status, fios, menções @all/@here, entrada automática), DELETE exclui o canal
 * e todo o histórico.
 */
final class ChannelController extends AbstractChatController
{
    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): ?array
    {
        $channel = $this->channel($request, $actor);

        if ($method === 'PATCH') {
            $this->service->updateChannel($channel, $actor, $this->body($request));
        }

        if ($method === 'DELETE') {
            $this->service->deleteChannel($channel, $actor);

            return null;
        }

        return $this->presentChannel($channel, $actor);
    }
}
