<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Ai\Fake;

use Ramon\Canela\Ai\Llm\LlmClient;
use Ramon\Canela\Ai\Llm\LlmException;
use Ramon\Canela\Ai\Llm\LlmRequest;
use Ramon\Canela\Ai\Llm\LlmResult;

/**
 * O provedor de IA falso dos testes: nenhuma chamada sai da máquina.
 *
 * Cada `send` guarda o pedido em `$requests` e devolve a próxima resposta
 * da fila `$replies` — um texto, ou uma LlmException para simular a falha do
 * provedor. Fila vazia: "Resposta falsa.". Com `$onText` (streaming), o texto
 * chega em dois pedaços, como do provedor de verdade.
 *
 * Estado estático: cada teste de integração roda num processo próprio.
 */
final class FakeLlm implements LlmClient
{
    /** @var list<LlmRequest> */
    public static array $requests = [];

    /** @var list<string|LlmException> */
    public static array $replies = [];

    public static function reset(): void
    {
        self::$requests = [];
        self::$replies = [];
    }

    /** @param string|LlmException ...$replies */
    public static function queue(string|LlmException ...$replies): void
    {
        array_push(self::$replies, ...$replies);
    }

    #[\Override]
    public function send(LlmRequest $request, ?callable $onText = null): LlmResult
    {
        self::$requests[] = $request;

        $reply = array_shift(self::$replies) ?? 'Resposta falsa.';

        if ($reply instanceof LlmException) {
            throw $reply;
        }

        if ($onText !== null) {
            $half = intdiv(mb_strlen($reply), 2);
            $onText(mb_substr($reply, 0, $half));
            $onText(mb_substr($reply, $half));
        }

        return new LlmResult($reply, [], ['role' => 'assistant', 'content' => $reply], 'end_turn', $request->model, 12, 34);
    }
}
