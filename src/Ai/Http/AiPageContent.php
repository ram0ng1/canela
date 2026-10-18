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

namespace Ramon\Canela\Ai\Http;

use Flarum\Frontend\Document;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Locale\TranslatorInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Ai\AiSettings;

/**
 * As rotas `/ai/conversations[/{id}]` do servidor. A página é desenhada pelo
 * JS; aqui só se garante que o endereço aberto direto não dê o 404 do Flarum
 * — e que dê, sim, 404 com o bot desligado ou sem provedor.
 *
 * As conversas não vêm pré-carregadas: são de uma pessoa só e nunca devem ir
 * para um cache de página.
 */
final class AiPageContent
{
    public function __construct(
        private readonly AiSettings $settings,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): Document
    {
        if (! $this->settings->feature(AiSettings::BOT)) {
            throw new RouteNotFoundException();
        }

        $document->title = $this->translator->trans('ramon-canela.forum.ai.bot.page_title');
        $document->meta['robots'] = 'noindex';

        return $document;
    }
}
