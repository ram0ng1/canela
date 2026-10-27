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

/**
 * O pedido de resumo (`POST /api/canela/ai/summaries/{id}`): só o
 * `regenerate`, que refaz um resumo desatualizado.
 */
final class SummaryValidator extends AbstractValidator
{
    protected array $rules = [
        'regenerate' => ['nullable', 'boolean'],
    ];
}
