<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * A identidade visual gerada pelo nome do fórum (src/Brand): a chave geral,
 * as animações, o nome usado (vazio = o título do fórum), a variação sorteada
 * e, por área, a arte do tema, uma imagem enviada ou nada.
 */

use Flarum\Extend;
use Ramon\Canela\Brand\Api\DeleteBrandImageController;
use Ramon\Canela\Brand\Api\UploadBrandImageController;
use Ramon\Canela\Brand\Brand;

$image = static fn ($value): ?string => is_string($value) && $value !== '' ? $value : null;

$settings = (new Extend\Settings())
    // A chave geral (o cabeçalho do card) e as animações das artes.
    ->default('canela.brand_enabled', true)
    ->default('canela.brand_motion', true)
    ->serializeToForum('canelaBrandEnabled', 'canela.brand_enabled', 'boolval')
    ->serializeToForum('canelaBrandMotion', 'canela.brand_motion', 'boolval')
    // O modelo (forma), a borda e o efeito em volta: `auto` deixa o nome
    // escolher. E o logo do fórum no lugar do monograma.
    ->default('canela.brand_shape', 'auto')
    ->default('canela.brand_border', 'fill')
    ->default('canela.brand_effect', 'auto')
    ->default('canela.brand_use_logo', false)
    ->serializeToForum('canelaBrandShape', 'canela.brand_shape', static fn ($value): string => Brand::choice($value, Brand::SHAPES))
    ->serializeToForum('canelaBrandBorder', 'canela.brand_border', static fn ($value): string => Brand::choice($value, Brand::BORDERS))
    ->serializeToForum('canelaBrandEffect', 'canela.brand_effect', static fn ($value): string => Brand::choice($value, Brand::EFFECTS))
    ->serializeToForum('canelaBrandUseLogo', 'canela.brand_use_logo', 'boolval')
    ->default('canela.brand_name', '')
    ->default('canela.brand_variant', 0)
    ->serializeToForum('canelaBrandName', 'canela.brand_name', static fn ($value): string => trim((string) $value))
    ->serializeToForum('canelaBrandVariant', 'canela.brand_variant', 'intval');

foreach (Brand::AREAS as $area) {
    $settings
        ->default(Brand::modeKey($area), 'theme')
        ->serializeToForum(Brand::attribute($area), Brand::modeKey($area), [Brand::class, 'mode'])
        ->serializeToForum(Brand::attribute($area, 'Image'), Brand::imageKey($area), $image);
}

return [
    $settings,

    (new Extend\Routes('api'))
        ->post('/canela/brand/{area}', 'canela.brand.upload', UploadBrandImageController::class)
        ->delete('/canela/brand/{area}', 'canela.brand.delete', DeleteBrandImageController::class),
];
