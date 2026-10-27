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

namespace Ramon\Canela\Links\Validation;

use Flarum\Foundation\AbstractValidator;
use Ramon\Canela\Links\LinkClicks;

/**
 * O formato do clique (`POST /api/canela-link-click`): a postagem e o
 * endereço (até 2000 caracteres). O controller só pergunta se passa: fora do
 * formato, o clique não conta e a resposta continua 204 — quem tenta inflar
 * números não descobre o que foi recusado.
 */
final class LinkClickValidator extends AbstractValidator
{
    protected bool $validateMissingKeys = true;

    protected array $rules = [
        'post_id' => ['required', 'integer', 'min:1'],
        'url' => ['required', 'string', 'max:'.LinkClicks::MAX_URL_LENGTH],
    ];

    /** @param array<string, mixed> $attributes */
    public function passes(array $attributes): bool
    {
        return ! $this->makeValidator($attributes)->fails();
    }
}
