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

/** O `filter[tag]` das contagens: o slug de uma tag, ou nada (o fórum todo). */
final class TopicCountsValidator extends AbstractValidator
{
    protected array $rules = [
        'tag' => ['nullable', 'string', 'max:255'],
    ];
}
