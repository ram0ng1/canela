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

namespace Ramon\Canela\Ai;

use Flarum\Locale\TranslatorInterface;
use Ramon\Canela\Ai\Llm\LlmException;
use Throwable;

/**
 * A mensagem que a pessoa vê quando a IA falha.
 *
 * O texto do provedor fica no log (pode trazer detalhes da conta); para quem
 * usa vai uma frase traduzida que diz o que fazer — tentar de novo, esperar,
 * ou avisar o administrador.
 */
final class AiErrors
{
    public function __construct(
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function describe(Throwable $error): string
    {
        $reason = $error instanceof LlmException ? $error->reason : 'generic';

        if (! $error instanceof LlmException || ! in_array($reason, ['aborted', 'rate_limit', 'overloaded'], true)) {
            error_log(sprintf('[ramon/canela] IA: %s: %s', $error::class, $error->getMessage()));
        }

        $known = ['auth', 'rate_limit', 'overloaded', 'network', 'server', 'bad_request', 'not_configured', 'aborted'];

        return $this->translator->trans('ramon-canela.api.ai.errors.'.(in_array($reason, $known, true) ? $reason : 'generic'));
    }

    public function message(string $key, array $parameters = []): string
    {
        return $this->translator->trans('ramon-canela.api.ai.errors.'.$key, $parameters);
    }
}
