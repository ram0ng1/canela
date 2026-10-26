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
use Laminas\Diactoros\Response;
use Laminas\Diactoros\Stream;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\BugReports\BugReportImages;
use Ramon\Canela\BugReports\BugReportsSettings;

/**
 * `GET /api/canela-bug-reports/{id}/{region|full}`: a captura, só para o admin
 * ou para quem reportou. Privada e sem cache compartilhado.
 */
final class ReportImageController implements RequestHandlerInterface
{
    public function __construct(
        private readonly BugReportsSettings $settings,
        private readonly BugReportImages $images,
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

        $report = ReportController::find($request, $actor);
        $which = Arr::get($request->getQueryParams(), 'which') === 'full' ? $report->full_path : $report->region_path;
        $bytes = $this->images->read($which);

        if ($bytes === null) {
            throw new RouteNotFoundException();
        }

        $body = new Stream('php://temp', 'wb+');
        $body->write($bytes);
        $body->rewind();

        return new Response($body, 200, [
            'Content-Type' => 'image/webp',
            'Content-Length' => (string) strlen($bytes),
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
