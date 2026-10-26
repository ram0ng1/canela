<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\forum;

use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\Test;

/**
 * O tema sobe sozinho e com as extensões opcionais que ele integra: as
 * migrações rodam, o fórum renderiza e os atributos do tema chegam na API.
 */
class BootTest extends TestCase
{
    #[Test]
    public function forum_renderiza_so_com_o_tema(): void
    {
        $this->extension('ramon-canela');

        $response = $this->send($this->request('GET', '/'));

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertStringContainsString('flarum-loading', (string) $response->getBody());
    }

    #[Test]
    public function forum_renderiza_com_as_extensoes_opcionais(): void
    {
        $this->extension('flarum-tags', 'flarum-likes', 'flarum-mentions', 'flarum-sticky', 'flarum-flags', 'flarum-suspend', 'flarum-messages', 'ramon-canela');

        $response = $this->send($this->request('GET', '/'));

        $this->assertEquals(200, $response->getStatusCode());
    }

    #[Test]
    public function atributos_do_tema_chegam_ao_forum(): void
    {
        $this->extension('ramon-canela');

        $response = $this->send($this->request('GET', '/api'));

        $this->assertEquals(200, $response->getStatusCode());

        $attributes = json_decode((string) $response->getBody(), true)['data']['attributes'];

        $this->assertArrayHasKey('canelaTintedBackground', $attributes);
        $this->assertArrayHasKey('canelaLucideIcons', $attributes);
    }

    #[Test]
    public function rotas_de_extensao_desabilitada_nao_existem(): void
    {
        // Com o flarum/messages instalado mas desabilitado, o tema não pode
        // registrar o recurso de conversas dele (a tabela nem existe).
        $this->extension('ramon-canela');

        $response = $this->send($this->request('GET', '/api/dialogs', ['authenticatedAs' => 1]));

        $this->assertEquals(404, $response->getStatusCode());
    }
}
