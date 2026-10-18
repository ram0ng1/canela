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

namespace Ramon\Canela\Ai\Tools;

use Flarum\User\User;
use Ramon\Canela\Ai\Llm\ToolDefinition;

/**
 * Uma ferramenta que o bot pode chamar. Roda sempre como a pessoa que
 * conversa: o bot nunca vê o que ela não veria no fórum.
 */
interface AiTool
{
    public function definition(): ToolDefinition;

    /**
     * @param array<string, mixed> $input já conferida contra o schema
     */
    public function run(array $input, User $actor): ToolOutput;
}
