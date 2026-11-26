<?php

declare(strict_types=1);

namespace Ramon\Canela\Tests\unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\Brand\Brand;

/**
 * As escolhas de cada área da identidade visual: um valor fora da lista
 * volta para a arte do tema, e o atributo do fórum segue o nome da área.
 */
final class BrandTest extends TestCase
{
    public function test_modo_desconhecido_volta_para_a_arte_do_tema(): void
    {
        self::assertSame('image', Brand::mode('image'));
        self::assertSame('none', Brand::mode('none'));
        self::assertSame('theme', Brand::mode('<script>'));
        self::assertSame('theme', Brand::mode(null));
    }

    public function test_modelo_borda_e_efeito_fora_da_lista_voltam_ao_padrao(): void
    {
        self::assertSame('square', Brand::choice('square', Brand::SHAPES));
        self::assertSame('auto', Brand::choice('hexagon', Brand::SHAPES));
        self::assertSame('fill', Brand::choice(null, Brand::BORDERS));
        self::assertSame('glow', Brand::choice('glow', Brand::EFFECTS));
    }

    public function test_chaves_e_atributos_de_cada_area(): void
    {
        self::assertSame('canela.brand_not_found', Brand::modeKey('not_found'));
        self::assertSame('canela.brand_welcome_image', Brand::imageKey('welcome'));
        self::assertSame('canelaBrandNotFound', Brand::attribute('not_found'));
        self::assertSame('canelaBrandHeaderImage', Brand::attribute('header', 'Image'));
    }
}
