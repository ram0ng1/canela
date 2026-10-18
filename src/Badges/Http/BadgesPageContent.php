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

namespace Ramon\Canela\Badges\Http;

use Flarum\Frontend\Document;
use Flarum\Locale\TranslatorInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Badges\BadgeSettings;

/**
 * O conteúdo de /badges e /badges/:id no servidor: o título da aba e o 404
 * com os emblemas desligados — sem isso, o fórum abriria a página e só então
 * descobriria, pela API, que ela não existe.
 */
final class BadgesPageContent
{
    public function __construct(
        private readonly BadgeSettings $settings,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        $this->settings->assertBadgesEnabled();

        $document->title = $this->translator->trans('ramon-canela.forum.badges.page_title');
    }
}
