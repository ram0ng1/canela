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

use Flarum\Foundation\ValidationException;
use Flarum\Locale\TranslatorInterface;
use Flarum\Settings\Event\Saving;
use Ramon\Canela\Theme\Logo\SvgSanitizer;

/**
 * O SVG próprio do indicador é limpo antes de ir para o banco: o que fica
 * gravado já é o que o fórum usa, e o admin vê na hora se o arquivo não serve.
 * A compilação do LESS limpa de novo (LoaderLess::clean), por garantia.
 *
 * Também prende o estilo e o tamanho às opções conhecidas.
 */
final class SanitizeLoaderSetting
{
    public function __construct(private readonly TranslatorInterface $translator)
    {
    }

    public function __invoke(Saving $event): void
    {
        if (array_key_exists(LoaderLess::STYLE, $event->settings)) {
            $style = (string) $event->settings[LoaderLess::STYLE];
            $event->settings[LoaderLess::STYLE] = in_array($style, LoaderPresets::keys(), true) ? $style : LoaderPresets::DEFAULT;
        }

        if (array_key_exists(LoaderLess::SIZE, $event->settings)) {
            $size = is_numeric($event->settings[LoaderLess::SIZE]) ? (int) $event->settings[LoaderLess::SIZE] : 100;
            $event->settings[LoaderLess::SIZE] = (string) max(LoaderLess::SIZE_MIN, min(LoaderLess::SIZE_MAX, $size));
        }

        if (array_key_exists(LoaderLess::COLOR, $event->settings)) {
            $color = trim((string) $event->settings[LoaderLess::COLOR]);
            $event->settings[LoaderLess::COLOR] = preg_match('/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $color) === 1 ? $color : '';
        }

        if (! array_key_exists(LoaderLess::CUSTOM, $event->settings)) {
            return;
        }

        $raw = trim((string) $event->settings[LoaderLess::CUSTOM]);

        if ($raw === '') {
            $event->settings[LoaderLess::CUSTOM] = '';

            return;
        }

        $clean = strlen($raw) > LoaderLess::MAX_BYTES * 2 ? null : SvgSanitizer::sanitize($raw, true);

        if ($clean === null || strlen($clean) > LoaderLess::MAX_BYTES) {
            throw new ValidationException([
                LoaderLess::CUSTOM => $this->translator->trans('ramon-canela.api.loader.invalid_svg'),
            ]);
        }

        $event->settings[LoaderLess::CUSTOM] = $clean;
    }
}
