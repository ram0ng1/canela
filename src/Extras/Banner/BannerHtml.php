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

namespace Ramon\Canela\Extras\Banner;

use Flarum\Formatter\Formatter;
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Guest;
use Illuminate\Contracts\Cache\Repository as Cache;
use Psr\Log\LoggerInterface;
use Ramon\Canela\Extras\Extras;
use Throwable;

/**
 * Converte o texto do banner de anúncio (`canela.banner_text`) no HTML que o
 * fórum recebe como `canelaBannerHtml`.
 *
 * - Texto que começa com uma tag é HTML do admin e vai como está — a mesma
 *   confiança que o Flarum já dá ao "HTML personalizado do cabeçalho", que só
 *   o admin edita.
 * - O resto passa pelo formatador das postagens: markdown, BBCode, emoji e
 *   links funcionam como no editor, e o s9e escapa o que não for formatação.
 *
 * O resultado fica em cache pelo hash do texto: o atributo é serializado a
 * cada carregamento do fórum, e formatar a cada requisição seria desperdício.
 * Texto novo, hash novo — o cache velho simplesmente deixa de ser lido.
 */
final class BannerHtml
{
    public function __construct(
        private readonly Formatter $formatter,
        private readonly Cache $cache,
        private readonly LoggerInterface $log,
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function __invoke(mixed $value): string
    {
        $text = trim((string) $value);

        // Desligado, o texto nem sai do servidor: só some da tela não basta
        // quando o anúncio foi tirado do ar por um motivo.
        if ($text === '' || ! Extras::enabled($this->settings, Extras::BANNER)) {
            return '';
        }

        if (str_starts_with($text, '<')) {
            return $text;
        }

        return $this->cache->rememberForever('canela.banner.'.sha1($text), function () use ($text): string {
            try {
                // Um visitante como autor: os formatadores de menções e afins
                // consultam permissões do autor, e nulo os derrubaria.
                return $this->formatter->render($this->formatter->parse($text, null, new Guest()));
            } catch (Throwable $error) {
                $this->log->warning('[canela] o banner não pôde ser formatado; usando texto puro.', ['exception' => $error]);

                return nl2br(htmlspecialchars($text, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            }
        });
    }
}
