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

use RuntimeException;

/**
 * Uma falha ao falar com o provedor. O `reason` é uma chave curta (`auth`,
 * `rate_limit`, `overloaded`, `network`, `bad_request`, `server`) que vira
 * uma mensagem traduzida para quem usa; o texto original do provedor fica na
 * mensagem da exceção, para o log e para o "Testar conexão" do admin.
 */
final class LlmException extends RuntimeException
{
    public function __construct(
        public readonly string $reason,
        string $message,
        public readonly int $status = 0,
    ) {
        parent::__construct($message);
    }

    public static function fromStatus(int $status, string $message): self
    {
        $reason = match (true) {
            $status === 401, $status === 403 => 'auth',
            $status === 429 => 'rate_limit',
            $status === 529, $status === 503 => 'overloaded',
            $status >= 500 => 'server',
            default => 'bad_request',
        };

        return new self($reason, $message !== '' ? $message : 'HTTP '.$status, $status);
    }
}
