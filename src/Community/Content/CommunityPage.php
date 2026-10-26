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

use Closure;
use Flarum\Frontend\Document;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Community\Community;
use Ramon\Canela\Community\GuidelinesPage;

/**
 * O conteúdo das rotas /about, /u e /g no servidor: o título da aba (que o
 * Mithril depois mantém) e o 404 quando o recurso está desligado — sem isso o
 * fórum abriria a página e só então descobriria que ela não existe.
 */
final class CommunityPage
{
    public function __construct(
        private readonly Community $community,
        private readonly TranslatorInterface $translator,
    ) {
    }

    /** O callback de uma página, no formato que o `Extend\Frontend::route()` espera. */
    public static function for(string $settingKey, string $titleKey): Closure
    {
        return static function (Document $document, ServerRequestInterface $request) use ($settingKey, $titleKey): void {
            resolve(self::class)->render($document, $settingKey, $titleKey, RequestUtil::getActor($request));
        };
    }

    public function render(Document $document, string $settingKey, string $titleKey, User $actor): void
    {
        $this->community->assertEnabled($settingKey);

        // As diretrizes só existem com conteúdo definido no admin — e, sendo
        // uma página do fof/pages, visível para quem pede.
        if ($settingKey === Community::GUIDELINES_ENABLED && ! resolve(GuidelinesPage::class)->hasContent($actor)) {
            throw new RouteNotFoundException();
        }

        $document->title = $this->translator->trans("ramon-canela.forum.community.$titleKey");
    }
}
