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
 * `/api/chat/channels/{id}/membership`: a participação do ator.
 *
 * - POST: "Participar".
 * - PATCH: silenciar, nível de notificação, favoritar.
 * - DELETE: "Sair do canal" (ou fechar a MD).
 */
final class MembershipController extends AbstractChatController
{
    #[\Override]
    protected function respond(ServerRequestInterface $request, User $actor, string $method): ?array
    {
        $channel = $this->channel($request, $actor);

        match ($method) {
            'POST' => $this->service->follow($channel, $actor),
            'PATCH' => $this->service->updateMembership($channel, $actor, $this->body($request)),
            'DELETE' => $this->service->leave($channel, $actor),
            default => null,
        };

        // Sair de um grupo de MD tira o acesso: a resposta não pode mostrar o canal.
        if ($method === 'DELETE' && $channel->isDirect() && $channel->is_group) {
            return null;
        }

        return $this->presentChannel($channel, $actor);
    }
}
