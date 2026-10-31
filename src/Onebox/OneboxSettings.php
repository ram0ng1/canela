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

use Flarum\Settings\SettingsRepositoryInterface;

/** As chaves do onebox do GitHub. O token nunca vai para o fórum. */
final class OneboxSettings
{
    public const GITHUB = 'canela.onebox_github';

    public const GITHUB_TOKEN = 'canela.onebox_github_token';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function githubEnabled(): bool
    {
        return (bool) $this->settings->get(self::GITHUB, true);
    }

    public function githubToken(): string
    {
        return trim((string) $this->settings->get(self::GITHUB_TOKEN, ''));
    }
}
