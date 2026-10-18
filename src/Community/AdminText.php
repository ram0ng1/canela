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

namespace Ramon\Canela\Community;

use Flarum\Formatter\Formatter;
use Illuminate\Contracts\Cache\Repository as Cache;
use Psr\Http\Message\ServerRequestInterface;
use Throwable;

/**
 * Os textos longos que o admin escreve para as páginas de comunidade (o
 * "sobre", as diretrizes) em HTML. Com tags HTML, o texto vai como está — o
 * admin já é dono do HTML do fórum (a mensagem de boas-vindas do core é
 * igual). Sem tags, passa pelo formatador das postagens, para valer o
 * Markdown e o BBCode que o fórum tiver ligados; o resultado fica em cache
 * pelo conteúdo, então editar o texto já vale na próxima abertura.
 */
final class AdminText
{
    public const CACHE_TTL = 1800;

    public function __construct(
        private readonly Formatter $formatter,
        private readonly Cache $cache,
    ) {
    }

    public function render(string $text, ServerRequestInterface $request): ?string
    {
        $text = trim($text);

        if ($text === '') {
            return null;
        }

        if (preg_match('/<[a-z][^>]*>/i', $text) === 1) {
            return $text;
        }

        return $this->cache->remember('canela.about.text.'.md5($text), self::CACHE_TTL, function () use ($text, $request) {
            try {
                return $this->formatter->render($this->formatter->parse($text), null, $request);
            } catch (Throwable) {
                // Um plugin do formatador que falhe não pode derrubar a página.
                return '<p>'.nl2br(htmlspecialchars($text, ENT_QUOTES)).'</p>';
            }
        });
    }
}
