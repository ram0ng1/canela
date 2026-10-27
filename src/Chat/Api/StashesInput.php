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

namespace Ramon\Canela\Chat\Api;

use Closure;

/**
 * Os campos graváveis dos recursos do chat não escrevem direto no modelo:
 * guardam o valor (já validado pelas regras do campo) e o `create`/`update`
 * do recurso entrega tudo ao ChatService, que grava numa transação, confere
 * o que depende de mais de um campo (o slug livre, a tag visível, o status
 * que não reabre) e avisa o canal pelo websocket.
 *
 * Só os campos enviados entram: o serviço distingue "não mandou" de "mandou
 * vazio", como o PATCH pede.
 */
trait StashesInput
{
    /** @var \WeakMap<object, array<string, mixed>>|null */
    private ?\WeakMap $stashed = null;

    /** O setter de um campo: guarda o valor com o nome que o serviço usa. */
    protected function stash(string $key): Closure
    {
        return function (object $model, mixed $value) use ($key): void {
            $this->stashed ??= new \WeakMap();
            $this->stashed[$model] = [...($this->stashed[$model] ?? []), $key => $value];
        };
    }

    /** @return array<string, mixed> */
    protected function stashed(object $model): array
    {
        return $this->stashed[$model] ?? [];
    }
}
