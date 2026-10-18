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

namespace Ramon\Canela\Ai\Llm;

/**
 * Um pedido ao modelo, no formato neutro do tema — cada cliente o traduz para
 * a API do seu provedor.
 *
 * As mensagens são listas de entradas:
 * - `['role' => 'user', 'content' => string]`
 * - `['role' => 'assistant', 'content' => string]` (o histórico, só o texto)
 * - `['role' => 'assistant_raw', 'raw' => mixed]` (a resposta do modelo na
 *   forma do provedor, com as chamadas de ferramenta, para continuar o turno)
 * - `['role' => 'tool_results', 'results' => [['id', 'name', 'content', 'error']]]`
 *
 * Assim o laço das ferramentas não precisa saber de que provedor é a resposta
 * que ele está devolvendo: só a guarda e a manda de volta.
 */
final class LlmRequest
{
    /**
     * @param list<array<string, mixed>> $messages
     * @param list<ToolDefinition> $tools
     */
    public function __construct(
        public readonly string $model,
        public readonly string $system,
        public array $messages,
        public readonly array $tools = [],
        public readonly int $maxTokens = 16000,
        /** low | medium | high — o esforço do raciocínio, onde o modelo aceita. */
        public readonly string $effort = 'medium',
        /** A busca na web do provedor (só a Anthropic tem uma ferramenta própria). */
        public readonly bool $webSearch = false,
    ) {
    }

    public function withMessages(array $messages): self
    {
        $copy = clone $this;
        $copy->messages = $messages;

        return $copy;
    }
}
