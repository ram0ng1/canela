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

namespace Ramon\Canela\Community\Http;

use Flarum\Http\Exception\RouteNotFoundException;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Community\LegalPages;

/**
 * /tos e /privacy, como no Discourse com `tos_url`/`privacy_policy_url`: levam
 * ao endereço da política (do fof/terms ou do admin do tema). Sem endereço, a
 * página não existe — 404, e não uma página vazia.
 */
final class LegalPageRedirect implements RequestHandlerInterface
{
    public function __construct(
        private readonly LegalPages $pages
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $url = $this->pages->url((string) Arr::get($request->getQueryParams(), 'page'));

        if ($url === null) {
            throw new RouteNotFoundException();
        }

        return new RedirectResponse($url, 302);
    }
}
