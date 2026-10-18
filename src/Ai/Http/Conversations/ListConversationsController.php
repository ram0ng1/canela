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

namespace Ramon\Canela\Ai\Http\Conversations;

use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Conversation;
use Ramon\Canela\Ai\Http\AiGate;

/**
 * `GET /api/canela/ai/conversations`: as conversas da pessoa, da mais
 * recente para a mais antiga, para a barra lateral da página de conversas
 * (Hoje, Últimos sete dias, Últimos 30 dias, e os meses).
 *
 * Paginado por `page[offset]` em blocos de 50: a barra carrega mais quando se
 * rola até o fim.
 */
final class ListConversationsController implements RequestHandlerInterface
{
    private const LIMIT = 50;

    public function __construct(
        private readonly AiGate $gate,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->gate->feature(AiSettings::BOT);

        $actor = RequestUtil::getActor($request);
        $this->gate->user($actor);

        $offset = max(0, (int) ($request->getQueryParams()['page']['offset'] ?? 0));

        $conversations = Conversation::query()
            ->where('user_id', $actor->id)
            ->where('message_count', '>', 0)
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->skip($offset)
            ->take(self::LIMIT + 1)
            ->get();

        return new JsonResponse([
            'data' => $conversations->take(self::LIMIT)->map(static fn (Conversation $conversation): array => $conversation->toSummaryArray())->values()->all(),
            'hasMore' => $conversations->count() > self::LIMIT,
        ]);
    }
}
