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

use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Community\GuidelinesPage;

/**
 * POST /api/canela-guidelines/page — só admin: cria no fof/pages a página
 * "Diretrizes" com o texto atual das diretrizes do tema e a escolhe para o
 * /guidelines. Daí em diante, o conteúdo se edita no próprio fof/pages.
 */
final class CreateGuidelinesPageController implements RequestHandlerInterface
{
    public function __construct(private readonly GuidelinesPage $pages)
    {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        RequestUtil::getActor($request)->assertAdmin();

        if (! $this->pages->available()) {
            throw new ValidationException(['fof-pages' => 'fof/pages is not enabled.']);
        }

        $page = $this->pages->create();

        return new JsonResponse(['pageId' => (int) $page->id, 'title' => (string) $page->title], 201);
    }
}
