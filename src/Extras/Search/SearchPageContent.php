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

namespace Ramon\Canela\Extras\Search;

use Flarum\Frontend\Document;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\SettingsRepositoryInterface;
use Psr\Http\Message\ServerRequestInterface;
use Ramon\Canela\Extras\Extras;

/**
 * A rota `/search` do servidor. A página em si é desenhada pelo JS; aqui só se
 * garante que o endereço aberto direto (ou recarregado) não dê 404 do Flarum —
 * e que dê, sim, 404 com o recurso desligado no admin.
 *
 * Os resultados não vêm pré-carregados: a busca depende de filtros montados no
 * navegador, e repeti-la no servidor só atrasaria a primeira pintura.
 */
final class SearchPageContent
{
    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly TranslatorInterface $translator,
    ) {
    }

    public function __invoke(Document $document, ServerRequestInterface $request): Document
    {
        if (! Extras::enabled($this->settings, Extras::SEARCH_PAGE)) {
            throw new RouteNotFoundException();
        }

        $query = trim((string) ($request->getQueryParams()['q'] ?? ''));

        $document->title = $query !== ''
            ? $this->translator->trans('ramon-canela.forum.extras.search.meta_title_query', ['query' => $query])
            : $this->translator->trans('ramon-canela.forum.extras.search.meta_title');

        // Página de resultados não deve entrar no índice dos buscadores.
        $document->meta['robots'] = 'noindex';

        return $document;
    }
}
