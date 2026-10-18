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

use Flarum\Foundation\ValidationException;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Conversation;
use Ramon\Canela\Ai\Http\AiGate;

/**
 * `PATCH` e `DELETE /api/canela/ai/conversations/{id}`: renomear e excluir
 * uma conversa — o menu de contexto da barra lateral de conversas do
 * Discourse. Só a dona; a de outra pessoa responde 404.
 */
final class UpdateConversationController implements RequestHandlerInterface
{
    public function __construct(
        private readonly AiGate $gate,
        private readonly TranslatorInterface $translator,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->gate->feature(AiSettings::BOT);

        $actor = RequestUtil::getActor($request);
        $this->gate->user($actor);

        $conversation = Conversation::query()->where('user_id', $actor->id)->find(AiGate::routeId($request));

        if (! $conversation instanceof Conversation) {
            throw new RouteNotFoundException();
        }

        if ($request->getMethod() === 'DELETE') {
            $conversation->delete();

            return new EmptyResponse(204);
        }

        $title = trim((string) (AiGate::body($request)['title'] ?? ''));

        if ($title === '' || mb_strlen($title) > 120) {
            throw new ValidationException(['title' => $this->translator->trans('ramon-canela.api.ai.errors.invalid_title')]);
        }

        // Renomear não é atividade: a conversa não sobe para o topo da lista.
        $conversation->timestamps = false;
        $conversation->title = $title;
        $conversation->save();

        return new JsonResponse(['data' => $conversation->toSummaryArray()]);
    }
}
