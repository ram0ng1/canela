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

namespace Ramon\Canela\Onebox;

/**
 * Os pedidos ao GitHub do onebox: um GET num endereço que o próprio tema
 * montou (api.github.com ou raw.githubusercontent.com). Os testes trocam a
 * implementação por uma falsa; nenhum pedido sai da máquina.
 */
interface GithubHttp
{
    /**
     * @param array<string, string> $headers
     *
     * @return array{status: int, body: string} status 0 = falhou sem resposta
     */
    public function get(string $url, array $headers, int $maxBytes): array;
}
