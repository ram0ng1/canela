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

namespace Ramon\Canela\BugReports;

use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;

/**
 * As chaves do "Relatar problema" e quem pode usá-lo.
 *
 * Desligado por padrão: o recurso guarda capturas de tela, e o admin decide
 * quando ligar. Reportar pede a permissão `canela.reportBugs` (os membros, por
 * padrão; o admin muda em Permissões).
 */
final class BugReportsSettings
{
    public const ENABLED = 'canela.bug_reports_enabled';

    /** O botão flutuante para quem pode reportar. Desligado, só com `?bugs=1` na URL. */
    public const BUTTON = 'canela.bug_reports_button';

    /** Os erros recentes do console vão junto com o relatório. */
    public const CONSOLE = 'canela.bug_reports_console';

    /** A captura da tela inteira vai junto com a da área marcada. */
    public const FULL = 'canela.bug_reports_full';

    public const PERMISSION = 'canela.reportBugs';

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function enabled(): bool
    {
        return (bool) $this->settings->get(self::ENABLED);
    }

    public function canReport(User $actor): bool
    {
        return $this->enabled() && ! $actor->isGuest() && $actor->hasPermission(self::PERMISSION);
    }

    public function bool(string $key, bool $default): bool
    {
        $value = $this->settings->get($key);

        return $value === null || $value === '' ? $default : (bool) $value;
    }
}
