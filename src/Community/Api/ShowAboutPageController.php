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

namespace Ramon\Canela\Community\Api;

use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Community\AboutPages;

/**
 * GET /api/canela-about-pages/{id}: uma das abas extras da área Sobre. Só
 * responde pelas páginas da lista do admin, e com a visibilidade do fof/pages;
 * qualquer outra (ou sem o fof/pages) é 404, para o endpoint não virar um
 * jeito de ler páginas fora da área.
 */
final class ShowAboutPageController implements RequestHandlerInterface
{
    public function __construct(
        private readonly AboutPages $pages,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $actor->assertCan('viewForum');

        // O Flarum junta os parâmetros da rota aos da query.
        $id = (int) ($request->getQueryParams()['id'] ?? 0);
        $page = $this->pages->find($actor, $id);

        if ($page === null) {
            throw new RouteNotFoundException();
        }

        return new JsonResponse([
            'html' => $this->pages->html($page),
            'title' => (string) $page->title,
            'label' => $this->pages->label($page),
            'pageId' => (int) $page->id,
        ]);
    }
}
