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
use Ramon\Canela\Ai\Llm\LlmFactory;

/**
 * A fábrica de clientes de IA dos testes: sempre o FakeLlm. Entra no container
 * no lugar da LlmFactory (FakeLlmServiceProvider), e assim o bot, o resumo, o
 * ajudante e o teste de conexão passam pelo caminho de verdade até o provedor.
 */
final class FakeLlmFactory extends LlmFactory
{
    public function __construct()
    {
        // Sem as dependências da fábrica de verdade: nada aqui as usa.
    }

    /** O provedor sem configuração continua recusando, como o de verdade. */
    public static bool $configured = true;

    #[\Override]
    public function make(): LlmClient
    {
        if (! self::$configured) {
            throw new LlmException('not_configured', 'O provedor de IA não está configurado.');
        }

        return new FakeLlm();
    }

    #[\Override]
    public function supportsWebSearch(): bool
    {
        return false;
    }
}
