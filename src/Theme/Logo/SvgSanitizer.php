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

namespace Ramon\Canela\Theme\Logo;

use DOMDocument;
use DOMElement;

/**
 * Limpa um SVG enviado pelo admin antes de ele virar arquivo público.
 *
 * Lista de permissões, e não de bloqueio: só ficam elementos de desenho e
 * atributos que não executam nada. Saem scripts, `foreignObject`, eventos
 * (`on*`), links para fora (`href` que não seja `#id` ou imagem raster em
 * `data:`) e `url()`/`@import` externos. Sem DTD nem entidades.
 */
final class SvgSanitizer
{
    private const ELEMENTS = [
        'svg', 'g', 'defs', 'symbol', 'use', 'title', 'desc', 'metadata',
        'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
        'text', 'tspan', 'textpath', 'image', 'clippath', 'mask', 'pattern', 'marker',
        'lineargradient', 'radialgradient', 'stop', 'filter', 'style',
        'feblend', 'fecolormatrix', 'fecomponenttransfer', 'fecomposite', 'feflood',
        'fegaussianblur', 'femerge', 'femergenode', 'feoffset', 'fedropshadow',
        'fefunca', 'fefuncb', 'fefuncg', 'fefuncr', 'femorphology', 'feturbulence',
    ];

    /** `url(` que não aponta para um `#id` do próprio arquivo. */
    private const EXTERNAL_URL = '/url\(\s*["\x27]?\s*(?!#)/i';

    public static function sanitize(string $svg): ?string
    {
        if (trim($svg) === '' || stripos($svg, '<!ENTITY') !== false || stripos($svg, '<!DOCTYPE') !== false) {
            return null;
        }

        $document = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($svg, LIBXML_NONET);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        $root = $document->documentElement;

        if (! $loaded || ! $root || strtolower($root->localName) !== 'svg') {
            return null;
        }

        self::clean($root);

        return $document->saveXML($root) ?: null;
    }

    private static function clean(DOMElement $element): void
    {
        foreach (iterator_to_array($element->childNodes) as $child) {
            if ($child instanceof DOMElement) {
                if (! in_array(strtolower($child->localName), self::ELEMENTS, true)) {
                    $element->removeChild($child);
                    continue;
                }

                self::clean($child);
            } elseif ($child->nodeType === XML_PI_NODE || $child->nodeType === XML_COMMENT_NODE) {
                $element->removeChild($child);
            }
        }

        foreach (iterator_to_array($element->attributes) as $attribute) {
            $name = strtolower($attribute->nodeName);
            $value = trim($attribute->nodeValue ?? '');

            $unsafe = str_starts_with($name, 'on')
                || (str_ends_with($name, 'href') && ! self::safeHref($value))
                || stripos($value, 'javascript:') !== false
                || preg_match(self::EXTERNAL_URL, $value) === 1
                || ($name === 'style' && self::cssEscaped($value));

            if ($unsafe) {
                $element->removeAttributeNode($attribute);
            }
        }

        // <style>: sem @import nem url() para fora.
        if (strtolower($element->localName) === 'style') {
            $css = $element->textContent;

            if (stripos($css, '@import') !== false || stripos($css, 'javascript:') !== false || stripos($css, 'expression(') !== false || preg_match(self::EXTERNAL_URL, $css) === 1 || self::cssEscaped($css)) {
                $element->textContent = '';
            }
        }
    }

    /**
     * Escape de CSS (`\75 rl(`, `@\69mport`): o navegador desfaz o escape e lê
     * `url(`/`@import`, que as buscas por texto acima não reconhecem. Um logo
     * não precisa disso, então CSS com barra invertida não passa.
     */
    private static function cssEscaped(string $css): bool
    {
        return str_contains($css, '\\');
    }

    private static function safeHref(string $value): bool
    {
        return str_starts_with($value, '#') || preg_match('#^data:image/(png|jpe?g|gif|webp);base64,#i', $value) === 1;
    }
}
