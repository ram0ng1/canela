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

namespace Ramon\Canela\Stats\Validation;

use Flarum\Foundation\AbstractValidator;

/**
 * O envio do tempo de leitura: o tópico, os segundos e as postagens que
 * passaram pela tela. Só o formato: os tetos (segundos por envio, postagens
 * por envio, o relógio) são do controller, que corta sem recusar — o envio
 * sai por `keepalive` e ninguém lê a resposta.
 */
final class ReadTimeValidator extends AbstractValidator
{
    protected bool $validateMissingKeys = true;

    protected array $rules = [
        'discussionId' => ['required', 'integer'],
        'seconds' => ['nullable', 'integer'],
        'postIds' => ['nullable', 'array'],
        'postIds.*' => ['integer'],
    ];
}
