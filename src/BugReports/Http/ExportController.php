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
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\TextResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\BugReports\BugReport;
use Ramon\Canela\BugReports\BugReportsSettings;
use Ramon\Canela\BugReports\PromptBuilder;

/**
 * `GET /api/canela-bug-reports-export`: as instruções para a IA com todos os
 * relatórios pendentes (até MAX), prontas para colar; com `?download=1`, como
 * arquivo .md. Só para quem pode exportar (BugReportPolicy::export).
 *
 * Continua um controlador, e não um endpoint do recurso: a resposta é um
 * arquivo Markdown, não um documento JSON:API. O de um relatório só é o
 * `GET /api/canela-bug-reports/{id}/prompt`, no BugReportResource.
 */
final class ExportController implements RequestHandlerInterface
{
    private const MAX = 200;

    public function __construct(
        private readonly BugReportsSettings $settings,
        private readonly PromptBuilder $prompts,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        if (! $this->settings->enabled()) {
            throw new RouteNotFoundException();
        }

        $actor = RequestUtil::getActor($request);
        $actor->assertCan('export', BugReport::class);

        $query = $request->getQueryParams();

        /** @var \Illuminate\Database\Eloquent\Collection<int, BugReport> $rows */
        $rows = BugReport::whereVisibleTo($actor)
            ->with('user')
            ->whereNotIn('status', ['fixed', 'wontfix'])
            ->orderBy('id')
            ->limit(self::MAX)
            ->get();

        $headers = ['Content-Type' => 'text/markdown; charset=utf-8', 'Cache-Control' => 'no-store'];

        if (Arr::get($query, 'download')) {
            $headers['Content-Disposition'] = 'attachment; filename="instrucoes-ia-'.date('Y-m-d').'.md"';
        }

        return new TextResponse($this->prompts->build($rows), 200, $headers);
    }
}
