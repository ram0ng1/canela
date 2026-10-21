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

namespace Ramon\Canela\ListRoutes;

use Flarum\Http\UrlGenerator;
use Laminas\Diactoros\Response\RedirectResponse;
use Override;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Links no formato /c/ para categorias (/c/suporte/6, /c/suporte/instalacao/31,
 * /c/suporte/6/l/top) levados à página da tag no Flarum (/t/instalacao).
 *
 * O slug é o último pedaço que não é número nem parte do sufixo de lista
 * (`l/<ordenação>`, `none`, `all`). A URL é montada à mão, e não pela rota
 * `tag` do flarum/tags, para não depender da extensão estar ativa.
 */
final class RedirectCategory implements RequestHandlerInterface
{
    private const IGNORED = ['none', 'all', 'l'];

    public function __construct(
        private readonly UrlGenerator $url,
    ) {
    }

    #[Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $path = (string) ($request->getAttribute('routeParameters')['path'] ?? '');
        $segments = array_values(array_filter(explode('/', $path), static fn (string $part): bool => $part !== ''));

        // Tudo depois de "/l/" é a ordenação da lista, não a categoria.
        $listAt = array_search('l', $segments, true);
        if ($listAt !== false) {
            $segments = array_slice($segments, 0, (int) $listAt);
        }

        $slug = null;
        foreach (array_reverse($segments) as $segment) {
            if (preg_match('/^\d+$/', $segment) !== 1 && ! in_array($segment, self::IGNORED, true)) {
                $slug = $segment;
                break;
            }
        }

        $base = rtrim($this->url->to('forum')->base(), '/');
        $target = $slug === null ? $base.'/categories' : $base.'/t/'.rawurlencode(rawurldecode($slug));

        return new RedirectResponse($target, 301);
    }
}
