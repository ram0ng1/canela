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
 * Uma ferramenta oferecida ao modelo: nome, descrição e o JSON Schema da
 * entrada. Os dois provedores aceitam o mesmo schema; muda só o envelope.
 */
final class ToolDefinition
{
    /**
     * @param array<string, mixed> $schema JSON Schema de um objeto, com `additionalProperties: false`
     */
    public function __construct(
        public readonly string $name,
        public readonly string $description,
        public readonly array $schema,
    ) {
    }
}
