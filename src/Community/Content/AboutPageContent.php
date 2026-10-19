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

namespace Ramon\Canela\Community\Content;

use Flarum\Frontend\Document;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Community\AboutPages;

/**
 * A rota /about/{id-slug} no servidor: o título da aba é o da página, e uma
 * página fora da lista do admin (ou invisível para quem pede) é 404 já no
 * documento, como as outras páginas de comunidade.
 */
final class AboutPageContent
{
    public function __construct(
        private readonly AboutPages $pages,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $id = AboutPages::idFromParam((string) ($request->getQueryParams()['page'] ?? ''));
        $page = $this->pages->find(RequestUtil::getActor($request), $id);

        if ($page === null) {
            throw new RouteNotFoundException();
        }

        $document->title = (string) $page->title;
    }
}
