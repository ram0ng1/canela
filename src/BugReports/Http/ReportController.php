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
use Flarum\User\User;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\EmptyResponse;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\BugReports\BugReport;
use Ramon\Canela\BugReports\BugReportImages;
use Ramon\Canela\BugReports\BugReportService;
use Ramon\Canela\BugReports\BugReportsSettings;

/**
 * `/api/canela-bug-reports/{id}`: ver (o admin ou quem reportou), mudar o
 * status e a nota (só o admin) e apagar (só o admin, com as imagens). O
 * relatório de outra pessoa responde como inexistente.
 */
final class ReportController implements RequestHandlerInterface
{
    public function __construct(
        private readonly BugReportsSettings $settings,
        private readonly BugReportService $reports,
        private readonly BugReportImages $images,
    ) {
    }

    /** O relatório, se o ator pode vê-lo; senão, 404. */
    public static function find(ServerRequestInterface $request, User $actor): BugReport
    {
        $id = (int) Arr::get($request->getQueryParams(), 'id', 0);
        $query = BugReport::query()->with('user');

        if (! $actor->isAdmin()) {
            $query->where('user_id', $actor->id);
        }

        /** @var BugReport|null $report */
        $report = $query->find($id);

        if (! $report) {
            throw new RouteNotFoundException();
        }

        return $report;
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->enabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertRegistered();

        $report = self::find($request, $actor);

        if ($request->getMethod() === 'GET') {
            return new JsonResponse(['report' => $this->reports->present($report, $actor->isAdmin())]);
        }

        $actor->assertAdmin();

        if ($request->getMethod() === 'DELETE') {
            $this->images->delete($report->region_path);
            $this->images->delete($report->full_path);
            $report->delete();

            return new EmptyResponse(204);
        }

        $body = (array) $request->getParsedBody();

        if (Arr::has($body, 'status') && in_array($body['status'], BugReport::STATUSES, true)) {
            $report->status = (string) $body['status'];
        }

        if (Arr::has($body, 'note')) {
            $report->admin_note = BugReportService::text($body['note'], 2000) ?: null;
        }

        $report->save();

        return new JsonResponse(['report' => $this->reports->present($report, true)]);
    }
}
