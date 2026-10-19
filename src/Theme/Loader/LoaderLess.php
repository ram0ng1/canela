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

namespace Ramon\Canela\Theme\Loader;

use DOMDocument;
use DOMElement;
use Flarum\Settings\SettingsRepositoryInterface;
use Ramon\Canela\Theme\Logo\SvgSanitizer;

/**
 * As variáveis do LESS do indicador de carregamento (less/forum/Loader.less).
 *
 * O SVG vai para dentro da folha do fórum como `data:` — e não para o payload
 * de cada página: a folha já é baixada uma vez e fica em cache, e assim o
 * indicador vale também para o `#flarum-loading`, que aparece antes do JS.
 *
 * Cada valor sai daqui pronto para `@config-…: <valor>;`. Qualquer coisa fora
 * do esperado vira o padrão do Flarum: um valor quebrado aqui derrubaria a
 * compilação da folha inteira.
 */
final class LoaderLess
{
    public const STYLE = 'canela.loader_style';
    public const CUSTOM = 'canela.loader_custom';
    public const TINT = 'canela.loader_tint';
    public const COLOR = 'canela.loader_color';
    public const SIZE = 'canela.loader_size';

    /** Teto do SVG próprio depois de limpo: ele entra na folha do fórum. */
    public const MAX_BYTES = 65536;

    public const SIZE_MIN = 50;
    public const SIZE_MAX = 250;

    /** Liga a troca do spinner (`@config-canela-loader-on`). */
    public static function on(mixed $value): string
    {
        return self::image() === 'none' ? 'false' : 'true';
    }

    /** O SVG como `url(data:…)`, ou `none` (`@config-canela-loader-image`). */
    public static function image(): string
    {
        return self::dataUrl(false);
    }

    /**
     * O mesmo desenho parado, para `prefers-reduced-motion`
     * (`@config-canela-loader-still`). Um `@media` dentro do SVG não basta:
     * numa imagem do CSS o navegador nem sempre o avalia, e o SMIL nem o lê.
     */
    public static function still(): string
    {
        return self::dataUrl(true);
    }

    private static function dataUrl(bool $still): string
    {
        try {
            $style = self::style();

            $svg = match (true) {
                $style === LoaderPresets::CUSTOM => self::clean((string) self::setting(self::CUSTOM, ''), $still),
                isset(LoaderPresets::SVG[$style]) => self::prepare(LoaderPresets::SVG[$style], $still),
                default => null,
            };

            return $svg === null ? 'none' : '~"url(data:image/svg+xml;base64,'.base64_encode($svg).')"';
        } catch (\Throwable) {
            return 'none';
        }
    }

    /**
     * Pintar com a cor do indicador (máscara) ou manter as cores do próprio
     * SVG (`@config-canela-loader-tint`). Os prontos são de uma cor só, então
     * a escolha só vale para o SVG próprio.
     */
    public static function tint(mixed $value): string
    {
        if (self::style() !== LoaderPresets::CUSTOM) {
            return 'true';
        }

        return $value === null || $value === '' || (bool) $value ? 'true' : 'false';
    }

    /** Hexadecimal escolhido ou a cor de destaque do tema (`@config-canela-loader-color`). */
    public static function color(mixed $value): string
    {
        $color = trim((string) $value);

        return preg_match('/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $color) === 1 ? $color : '~"var(--cn-accent)"';
    }

    /** Tamanho em relação ao do Flarum, como fator (`@config-canela-loader-scale`). */
    public static function scale(mixed $value): string
    {
        $percent = is_numeric($value) ? (int) $value : 100;
        $percent = max(self::SIZE_MIN, min(self::SIZE_MAX, $percent));

        return rtrim(rtrim(number_format($percent / 100, 2, '.', ''), '0'), '.');
    }

    /**
     * Limpa o SVG próprio: a lista de permissões do logo (com animação SMIL),
     * o teto de tamanho, a `viewBox` que falte e o freio de movimento.
     */
    public static function clean(string $raw, bool $still = false): ?string
    {
        $raw = trim($raw);

        if ($raw === '' || strlen($raw) > self::MAX_BYTES * 2) {
            return null;
        }

        $svg = SvgSanitizer::sanitize($raw, true);

        if ($svg === null || strlen($svg) > self::MAX_BYTES) {
            return null;
        }

        return self::prepare($svg, $still);
    }

    /**
     * Garante a `viewBox` (sem ela o desenho não acompanha o tamanho da
     * máscara) e põe, no começo, o `prefers-reduced-motion` que para as
     * animações de CSS do próprio SVG: de fora, o CSS da página não alcança
     * o que roda dentro da imagem. Na versão parada (`$still`), as animações
     * saem de vez: as de CSS por uma regra, as de SMIL tirando os elementos.
     */
    private static function prepare(string $svg, bool $still = false): ?string
    {
        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($svg, LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $document->documentElement;

        if (! $loaded || ! $root instanceof DOMElement) {
            return null;
        }

        $width = (float) $root->getAttribute('width');
        $height = (float) $root->getAttribute('height');

        if (! $root->hasAttribute('viewBox') && $width > 0 && $height > 0) {
            $root->setAttribute('viewBox', sprintf('0 0 %s %s', $width, $height));
        }

        // A largura e a altura fixas viram as da caixa do indicador.
        $root->removeAttribute('width');
        $root->removeAttribute('height');

        if ($still) {
            foreach (['animate', 'animateTransform', 'animateMotion', 'set'] as $tag) {
                foreach (iterator_to_array($document->getElementsByTagNameNS('*', $tag)) as $node) {
                    $node->parentNode?->removeChild($node);
                }
            }
        }

        $style = $document->createElementNS('http://www.w3.org/2000/svg', 'style');
        $style->textContent = $still ? '*{animation:none!important}' : '@media (prefers-reduced-motion:reduce){*{animation:none!important}}';
        $root->insertBefore($style, $root->firstChild);

        return $document->saveXML($root) ?: null;
    }

    private static function style(): string
    {
        $style = (string) self::setting(self::STYLE, LoaderPresets::DEFAULT);

        return in_array($style, LoaderPresets::keys(), true) ? $style : LoaderPresets::DEFAULT;
    }

    /**
     * Lido na hora pelo container: na compilação de teste que o core faz ao
     * salvar, o repositório é o que já tem os valores novos.
     */
    private static function setting(string $key, mixed $default): mixed
    {
        return resolve(SettingsRepositoryInterface::class)->get($key, $default);
    }
}
