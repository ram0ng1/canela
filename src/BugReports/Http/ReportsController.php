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
use Flarum\User\Exception\PermissionDeniedException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\BugReports\BugReport;
use Ramon\Canela\BugReports\BugReportService;
use Ramon\Canela\BugReports\BugReportsSettings;

/**
 * `GET /api/canela-bug-reports`: o admin vê todos (com filtro de status e
 * página); os demais, só os próprios ("Meus relatórios").
 * `POST /api/canela-bug-reports`: envia um relatório novo.
 */
final class ReportsController implements RequestHandlerInterface
{
    private const PER_PAGE = 20;

    public function __construct(
        private readonly BugReportsSettings $settings,
        private readonly BugReportService $reports,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->enabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        if ($request->getMethod() === 'POST') {
            if (! $this->settings->canReport($actor)) {
                throw new PermissionDeniedException();
            }

            $report = $this->reports->create($actor, (array) $request->getParsedBody());

            return new JsonResponse(['report' => $this->reports->present($report, false)], 201);
        }

        $query = $request->getQueryParams();
        $all = $actor->isAdmin() && ! Arr::get($query, 'mine');

        $base = BugReport::query();

        if (! $all) {
            $base->where('user_id', $actor->id);
        }

        $counts = (clone $base)->toBase()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status')->map(static fn ($n): int => (int) $n)->all();

        $status = (string) Arr::get($query, 'status', '');

        if ($status === 'active') {
            $base->whereNotIn('status', ['fixed', 'wontfix']);
        } elseif (in_array($status, BugReport::STATUSES, true)) {
            $base->where('status', $status);
        }

        $page = max(1, (int) Arr::get($query, 'page', 1));
        $total = (clone $base)->count();

        /** @var \Illuminate\Database\Eloquent\Collection<int, BugReport> $rows */
        $rows = $base->with('user')
            ->orderByDesc('id')
            ->offset(($page - 1) * self::PER_PAGE)
            ->limit(self::PER_PAGE)
            ->get();

        $reports = [];

        foreach ($rows as $report) {
            $reports[] = $this->reports->present($report, $all);
        }

        return new JsonResponse([
            'reports' => $reports,
            'counts' => $counts,
            'total' => $total,
            'page' => $page,
            'perPage' => self::PER_PAGE,
        ]);
    }
}
