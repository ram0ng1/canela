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

namespace Ramon\Canela\BugReports\Access;

use Flarum\User\Access\AbstractPolicy;
use Flarum\User\User;
use Ramon\Canela\BugReports\BugReport;

/**
 * Quem faz o quê com um relatório:
 *
 * - ver: quem reportou e a administração (o painel fica no admin);
 * - mudar status e nota, apagar e exportar as instruções para a IA: só a
 *   administração. `export` vale também sem um relatório
 *   (`assertCan('export', BugReport::class)`), para a exportação de todos.
 *
 * Reportar é a permissão global `canela.reportBugs`, conferida no endpoint de
 * criação. `deny` (e não nada) para os outros: sem resposta da policy, o Gate
 * cairia na tabela de permissões com o nome da habilidade.
 */
final class BugReportPolicy extends AbstractPolicy
{
    public function view(User $actor, BugReport $report): string
    {
        return self::manages($actor) || (! $actor->isGuest() && $report->user_id === (int) $actor->id) ? $this->allow() : $this->deny();
    }

    public function edit(User $actor, BugReport $report): string
    {
        return self::manages($actor) ? $this->allow() : $this->deny();
    }

    public function delete(User $actor, BugReport $report): string
    {
        return self::manages($actor) ? $this->allow() : $this->deny();
    }

    /** @param BugReport|class-string<BugReport> $report */
    public function export(User $actor, BugReport|string $report): string
    {
        return self::manages($actor) ? $this->allow() : $this->deny();
    }

    /** Acompanhar todos os relatórios é da administração. */
    public static function manages(User $actor): bool
    {
        return $actor->isAdmin();
    }
}
