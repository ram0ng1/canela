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

namespace Ramon\Canela\Ai\Validation;

use Flarum\Foundation\AbstractValidator;

/** O "Testar conexão" do admin: o modelo de linguagem (padrão) ou a API de embeddings. */
final class TestConnectionValidator extends AbstractValidator
{
    protected array $rules = [
        'target' => ['nullable', 'string', 'in:llm,embeddings'],
    ];
}
