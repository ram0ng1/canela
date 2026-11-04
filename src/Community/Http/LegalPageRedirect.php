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
use Flarum\Http\UrlGenerator;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\RedirectResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Community\AboutPages;
use Ramon\Canela\Community\LegalPages;

/**
 * /tos e /privacy: levam
 * ao endereço da política (do fof/terms ou do admin do tema); quando ele é uma
 * página do fof/pages, à aba dela na área Sobre (/about/{id}-{slug}). Sem
 * endereço, a página não existe — 404, e não uma página vazia.
 *
 * Um redirecionamento do fórum, e não da API: continua um controlador.
 */
final class LegalPageRedirect implements RequestHandlerInterface
{
    public function __construct(
        private readonly LegalPages $pages,
        private readonly AboutPages $about,
        private readonly UrlGenerator $url,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $key = (string) Arr::get($request->getQueryParams(), 'page');

        foreach ($this->pages->all() as $page) {
            if ($page['key'] !== $key) {
                continue;
            }

            // Uma página do fof/pages abre dentro da área Sobre, com as abas.
            if (isset($page['pageId']) && $this->about->enabled()) {
                $param = $page['pageId'].(($page['slug'] ?? '') !== '' ? '-'.$page['slug'] : '');

                return new RedirectResponse($this->url->to('forum')->route('canela.about_page', ['page' => $param]), 302);
            }

            return new RedirectResponse($page['url'], 302);
        }

        throw new RouteNotFoundException();
    }
}
