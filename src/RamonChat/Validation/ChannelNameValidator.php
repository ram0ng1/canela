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

namespace Ramon\Canela\RamonChat\Validation;

use Flarum\Foundation\AbstractValidator;

/** O nome do chat em grupo: uma linha (já limpa pelo endpoint) de até 50 caracteres; vazio volta ao rótulo pelos participantes. */
final class ChannelNameValidator extends AbstractValidator
{
    public const MAX_LENGTH = 50;

    protected bool $validateMissingKeys = true;

    protected array $rules = [
        'name' => ['nullable', 'string', 'max:'.self::MAX_LENGTH],
    ];

    #[\Override]
    protected function getMessages(): array
    {
        return [
            'name.max' => $this->translator->trans('ramon-canela.forum.chat.errors.name_too_long', ['count' => self::MAX_LENGTH]),
        ];
    }
}
