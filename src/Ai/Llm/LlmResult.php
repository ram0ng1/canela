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
 * O que voltou de uma chamada ao modelo.
 *
 * - `text`: o texto da resposta (o que se mostra).
 * - `toolCalls`: as ferramentas que o modelo pediu, cada uma com `id`, `name`,
 *   `input` (array) e `valid` — a entrada chega em pedaços durante o stream e
 *   pode vir cortada; uma entrada inválida volta como erro, nunca roda.
 * - `raw`: a mensagem do modelo na forma do provedor, para continuar o turno
 *   depois das ferramentas (a Anthropic exige os blocos de raciocínio de volta,
 *   intactos).
 * - `stopReason`: `end_turn`, `tool_use`, `max_tokens`, `pause_turn`, `refusal`…
 */
final class LlmResult
{
    /**
     * @param list<array{id: string, name: string, input: array<string, mixed>, valid: bool}> $toolCalls
     */
    public function __construct(
        public readonly string $text,
        public readonly array $toolCalls,
        public readonly mixed $raw,
        public readonly string $stopReason,
        public readonly string $model,
        public readonly int $inputTokens = 0,
        public readonly int $outputTokens = 0,
    ) {
    }

    public function refused(): bool
    {
        return $this->stopReason === 'refusal';
    }

    public function wantsTools(): bool
    {
        return $this->toolCalls !== [] && in_array($this->stopReason, ['tool_use', 'tool_calls'], true);
    }

    /** A Anthropic pausou um turno longo de ferramentas do servidor: é só reenviar. */
    public function paused(): bool
    {
        return $this->stopReason === 'pause_turn';
    }
}
