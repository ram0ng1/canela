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
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\User;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Community\AdminText;
use Ramon\Canela\Community\Community;
use Ramon\Canela\Community\GuidelinesPage;

/**
 * GET /api/canela-guidelines — as "Diretrizes" (/guidelines e /faq). Com o
 * fof/pages e uma página escolhida no admin, o conteúdo dela
 * (com a visibilidade do próprio fof/pages); senão o texto do admin. Sem
 * nenhum dos dois, 404: o modelo do tema só serve para criar a página.
 */
final class ShowGuidelinesController implements RequestHandlerInterface
{
    public function __construct(
        private readonly Community $community,
        private readonly SettingsRepositoryInterface $settings,
        private readonly AdminText $text,
        private readonly GuidelinesPage $pages,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->community->assertEnabled(Community::GUIDELINES_ENABLED);

        $actor = RequestUtil::getActor($request);
        $actor->assertCan('viewForum');

        if ($page = $this->fofPage($actor)) {
            return new JsonResponse($page);
        }

        $custom = trim((string) $this->settings->get(Community::GUIDELINES_TEXT));

        // Sem texto nem página visível, não há diretrizes: nada de texto padrão.
        if ($custom === '') {
            throw new RouteNotFoundException();
        }

        return new JsonResponse([
            'html' => $this->text->render($custom, $request),
            'custom' => true,
        ]);
    }

    /**
     * A página do fof/pages escolhida, se a extensão estiver ligada, a página
     * existir e o ator puder vê-la; null para cair no texto do tema.
     *
     * @return array{html: string, custom: true, title: string, pageId: int}|null
     */
    private function fofPage(User $actor): ?array
    {
        $page = $this->pages->find($actor);

        if ($page === null) {
            return null;
        }

        return [
            'html' => $this->pages->html($page),
            'custom' => true,
            'title' => (string) $page->title,
            'pageId' => (int) $page->id,
        ];
    }
}
