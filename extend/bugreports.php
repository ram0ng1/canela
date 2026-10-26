<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * Relatar problema: quem tem a permissão marca uma área da tela, descreve o
 * que está errado e envia; o relatório chega com a captura e o contexto da
 * página, e o admin acompanha tudo num painel. Baseado no Bugframe
 * (github.com/vmatheus3/bug-frame, MIT).
 *
 * As capturas ficam num disco privado (storage/canela-bug-reports), fora de
 * public/: só saem pela API, para o admin ou para quem reportou.
 */

use Flarum\Api\Resource\ForumResource;
use Flarum\Extend;
use Flarum\Foundation\Paths;
use Ramon\Canela\BugReports\Api\ForumResourceFields;
use Ramon\Canela\BugReports\BugReportImages;
use Ramon\Canela\BugReports\BugReportsSettings;
use Ramon\Canela\BugReports\Http\ExportController;
use Ramon\Canela\BugReports\Http\ReportController;
use Ramon\Canela\BugReports\Http\ReportImageController;
use Ramon\Canela\BugReports\Http\ReportsController;

return [
    (new Extend\Settings())
        ->default(BugReportsSettings::ENABLED, false)
        ->default(BugReportsSettings::BUTTON, true)
        ->default(BugReportsSettings::CONSOLE, false)
        ->default(BugReportsSettings::FULL, true),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(ForumResourceFields::class),

    (new Extend\Filesystem())
        ->disk(BugReportImages::DISK, static fn (Paths $paths): array => [
            'root' => "$paths->storage/canela-bug-reports",
        ]),

    (new Extend\Routes('api'))
        ->get('/canela-bug-reports', 'canela.bug_reports.index', ReportsController::class)
        ->post('/canela-bug-reports', 'canela.bug_reports.create', ReportsController::class)
        ->get('/canela-bug-reports-export', 'canela.bug_reports.export', ExportController::class)
        ->get('/canela-bug-reports/{id:\d+}', 'canela.bug_reports.show', ReportController::class)
        ->patch('/canela-bug-reports/{id:\d+}', 'canela.bug_reports.update', ReportController::class)
        ->delete('/canela-bug-reports/{id:\d+}', 'canela.bug_reports.delete', ReportController::class)
        ->get('/canela-bug-reports/{id:\d+}/prompt', 'canela.bug_reports.prompt', ExportController::class)
        ->get('/canela-bug-reports/{id:\d+}/{which:region|full}', 'canela.bug_reports.image', ReportImageController::class),
];
