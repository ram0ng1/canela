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
 * O lote de traduções (`POST /api/canela/ai/translate`): duas listas de ids.
 * Mais de 20 não é erro — o controller corta e o fórum pede o resto depois.
 */
final class TranslateValidator extends AbstractValidator
{
    protected array $rules = [
        'posts' => ['nullable', 'array'],
        'posts.*' => ['integer'],
        'discussions' => ['nullable', 'array'],
        'discussions.*' => ['integer'],
    ];
}
