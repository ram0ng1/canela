<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\ListRoutes;

use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;

/**
 * Os endereços curtos da lista: /latest, /hot, /top, /new e /unread abrem o
 * fórum (um F5 não dá 404) e /c/<slug>[/<id>] redireciona para /t/<slug>,
 * sempre dentro do próprio fórum.
 */
class ListRoutesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');
    }

    /**
     * Cada aba tem endereço próprio que abre o fórum.
     */
    #[Test]
    public function abas_abrem_o_forum(): void
    {
        foreach (['/latest', '/hot', '/top', '/new', '/unread', '/categories'] as $path) {
            $response = $this->send($this->request('GET', $path));

            $this->assertEquals(200, $response->getStatusCode(), $path);
        }
    }

    /**
     * O fórum anuncia que os endereços existem.
     */
    #[Test]
    public function forum_anuncia_as_rotas(): void
    {
        $attributes = json_decode((string) $this->send($this->request('GET', '/api'))->getBody(), true)['data']['attributes'];

        $this->assertTrue($attributes['canelaListRoutes']);
    }

    public static function categorias(): array
    {
        return [
            'slug e id' => ['/c/geral/12', 'http://localhost/t/geral'],
            'subcategoria' => ['/c/pai/filha/7', 'http://localhost/t/filha'],
            'com ordenação' => ['/c/geral/12/l/top', 'http://localhost/t/geral'],
            'só id' => ['/c/12', 'http://localhost/categories'],
            'all' => ['/c/geral/all', 'http://localhost/t/geral'],
        ];
    }

    /**
     * /c/... redireciona (301) para a tag certa ou para as categorias.
     */
    #[Test]
    #[DataProvider('categorias')]
    public function categoria_redireciona_para_a_tag(string $path, string $target): void
    {
        $response = $this->send($this->request('GET', $path));

        $this->assertEquals(301, $response->getStatusCode());
        $this->assertSame($target, $response->getHeaderLine('Location'));
    }

    /**
     * Nenhum caminho leva para fora do fórum: o slug é codificado e fica
     * sempre sob /t/ do próprio endereço.
     */
    #[Test]
    public function redirecionamento_nao_sai_do_forum(): void
    {
        foreach (['/c/%2F%2Fevil.example', '/c/https:%2F%2Fevil.example', '/c/..%2F..%2Fadmin'] as $path) {
            $location = $this->send($this->request('GET', $path))->getHeaderLine('Location');

            $this->assertStringStartsWith('http://localhost/', $location, $path);
            $this->assertSame('localhost', parse_url($location, PHP_URL_HOST), $path);
            $this->assertStringNotContainsString('/admin', $location, $path);
        }
    }
}
