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

namespace Ramon\Canela\Templates;

use Flarum\Settings\SettingsRepositoryInterface;

/**
 * A chave dos modelos do editor. Ligada por padrão: sem nenhum modelo criado
 * no admin, nada muda no composer.
 */
final class TemplatesSettings
{
    public const ENABLED = 'canela.templates_enabled';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function enabled(): bool
    {
        $value = $this->settings->get(self::ENABLED);

        return $value === null || $value === '' ? true : (bool) $value;
    }
}
