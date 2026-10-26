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

namespace Ramon\Canela\BugReports\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Ramon\Canela\BugReports\BugReportsSettings;

/**
 * `canelaBugReports`: as opções do botão para quem pode reportar, e null para
 * os demais (o fórum nem carrega o recurso).
 */
final class ForumResourceFields
{
    public function __construct(
        private readonly BugReportsSettings $settings,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Arr::make('canelaBugReports')
                ->nullable()
                ->get(fn (object $forum, Context $context): ?array => $this->settings->canReport($context->getActor()) ? [
                    'button' => $this->settings->bool(BugReportsSettings::BUTTON, true),
                    'console' => $this->settings->bool(BugReportsSettings::CONSOLE, false),
                    'full' => $this->settings->bool(BugReportsSettings::FULL, true),
                ] : null),
        ];
    }
}
