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

namespace Ramon\Canela\BugReports\Http;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Http\UrlGenerator;
use Flarum\Settings\SettingsRepositoryInterface;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\BugReports\BugReport;
use Ramon\Canela\BugReports\BugReportService;
use Ramon\Canela\BugReports\BugReportsSettings;
use Ramon\Canela\BugReports\Worklist;

/**
 * `GET /api/canela-bug-reports-export`: os relatórios em aberto como uma lista
 * em Markdown (só o admin), para baixar e entregar a quem vai corrigir.
 */
final class ExportController implements RequestHandlerInterface
{
    private const MAX = 500;

    public function __construct(
        private readonly BugReportsSettings $settings,
        private readonly BugReportService $reports,
        private readonly SettingsRepositoryInterface $config,
        private readonly UrlGenerator $url,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->enabled()) {
            throw new RouteNotFoundException();
        }

        RequestUtil::getActor($request)->assertAdmin();

        $rows = BugReport::query()
            ->with('user')
            ->whereNotIn('status', ['fixed', 'wontfix'])
            ->orderBy('id')
            ->limit(self::MAX)
            ->get();

        $api = rtrim($this->url->to('api')->base(), '/');
        $markdown = Worklist::markdown(
            $rows->map(fn (BugReport $report) => $this->reports->present($report, true))->values()->all(),
            (string) $this->config->get('forum_title', 'Flarum'),
            static fn (int $id, string $which): string => "$api/canela-bug-reports/$id/$which",
        );

        return new TextResponse($markdown, 200, [
            'Content-Type' => 'text/markdown; charset=utf-8',
            'Content-Disposition' => 'attachment; filename="relatorios-'.date('Y-m-d').'.md"',
            'Cache-Control' => 'no-store',
        ]);
    }
}
