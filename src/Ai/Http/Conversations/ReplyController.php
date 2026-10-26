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
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\AiErrors;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\BotReply;
use Ramon\Canela\Ai\Conversation;
use Ramon\Canela\Ai\Http\AiGate;
use Ramon\Canela\Ai\Http\NdjsonStream;
use Ramon\Canela\Ai\Personas;

/**
 * `POST /api/canela/ai/conversations/reply`: manda uma pergunta ao bot e
 * recebe a resposta em streaming (NDJSON).
 *
 * Sem `conversationId`, abre uma conversa nova — a "Nova pergunta" e o
 * "Perguntar à IA" da busca. A persona só vale na conversa
 * nova; uma conversa continua com a persona com que começou.
 */
final class ReplyController implements RequestHandlerInterface
{
    public const MIN_LENGTH = 2;

    public const MAX_LENGTH = 10000;

    public function __construct(
        private readonly AiGate $gate,
        private readonly BotReply $reply,
        private readonly Personas $personas,
        private readonly AiErrors $errors,
        private readonly TranslatorInterface $translator,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->gate->feature(AiSettings::BOT);

        $actor = RequestUtil::getActor($request);
        $this->gate->user($actor);
        $this->gate->quota($actor);

        $body = AiGate::body($request);
        $question = trim((string) ($body['message'] ?? ''));
        $length = mb_strlen($question);

        if ($length < self::MIN_LENGTH || $length > self::MAX_LENGTH) {
            throw new ValidationException(['message' => $this->translator->trans('ramon-canela.api.ai.errors.message_length', ['min' => self::MIN_LENGTH, 'max' => self::MAX_LENGTH])]);
        }

        $conversationId = (int) ($body['conversationId'] ?? 0);

        if ($conversationId > 0) {
            $conversation = Conversation::query()->where('user_id', $actor->id)->find($conversationId);

            if (! $conversation instanceof Conversation) {
                throw new RouteNotFoundException();
            }
        } else {
            $conversation = new Conversation();
            $conversation->persona = $this->personas->find(isset($body['persona']) ? (string) $body['persona'] : null)['id'] ?? null;
        }

        // O pedido conta aqui, antes do stream: depois dos cabeçalhos a recusa
        // já não vira um status HTTP.
        $this->gate->claim($actor);

        return NdjsonStream::response(
            fn (callable $write) => $this->reply->stream($actor, $conversation, $question, $write),
            $this->errors->describe(...)
        );
    }
}
