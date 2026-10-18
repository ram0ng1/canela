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

namespace Ramon\Canela\Chat\Content;

use Flarum\Frontend\Document;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Locale\TranslatorInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Chat\ChatSettings;

/**
 * O lado do servidor das páginas `/chat…`: o título da aba e o 404 com o chat
 * desligado — sem isso o fórum abriria a página e só então descobriria que ela
 * não existe. O conteúdo em si é todo do front-end.
 */
final class ChatPage
{
    public function __construct(
        private readonly ChatSettings $settings,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): void
    {
        if (! $this->settings->enabled()) {
            throw new RouteNotFoundException();
        }

        $document->title = $this->translator->trans('ramon-canela.forum.chat.title_capitalized');
    }
}
