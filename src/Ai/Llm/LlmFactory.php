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

use Ramon\Canela\Ai\AiSettings;

/**
 * O cliente do provedor escolhido no admin. Criado a cada uso, e não no boot:
 * trocar a chave ou o provedor vale já na próxima requisição.
 *
 * Não é `final`: é o ponto em que outro provedor (ou o provedor falso dos
 * testes de integração) entra no container, no lugar deste.
 */
class LlmFactory
{
    public function __construct(
        private readonly AiSettings $settings,
        private readonly HttpTransport $http,
    ) {
    }

    /**
     * @throws LlmException
     */
    public function make(): LlmClient
    {
        if (! $this->settings->configured()) {
            throw new LlmException('not_configured', 'O provedor de IA não está configurado.');
        }

        if ($this->settings->provider() === AiSettings::PROVIDER_OPENAI) {
            return new OpenAiClient($this->http, $this->settings->string(AiSettings::OPENAI_URL), $this->settings->string(AiSettings::OPENAI_KEY));
        }

        return new AnthropicClient($this->http, $this->settings->string(AiSettings::ANTHROPIC_KEY));
    }

    /** A busca na web própria do provedor só existe na Anthropic. */
    public function supportsWebSearch(): bool
    {
        return $this->settings->provider() === AiSettings::PROVIDER_ANTHROPIC;
    }
}
