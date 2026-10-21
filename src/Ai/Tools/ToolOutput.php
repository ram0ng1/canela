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

/**
 * O resultado de uma ferramenta: o texto que volta para o modelo e o resumo
 * que a resposta mostra ("Pesquisou por …", com os links).
 */
final class ToolOutput
{
    /**
     * @param array<string, mixed> $activity
     */
    public function __construct(
        public readonly string $content,
        public readonly array $activity,
        public readonly bool $error = false,
    ) {
    }
}
