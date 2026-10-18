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
 * Um provedor de modelo de linguagem.
 *
 * `send` sempre faz streaming quando há `$onText`: o texto chega ao navegador
 * enquanto é escrito, e uma resposta longa não esbarra no tempo limite da
 * requisição. Sem `$onText` a chamada é comum, para as tarefas curtas.
 */
interface LlmClient
{
    /**
     * @param (callable(string): void)|null $onText recebe cada pedaço de texto novo
     *
     * @throws LlmException
     */
    public function send(LlmRequest $request, ?callable $onText = null): LlmResult;
}
