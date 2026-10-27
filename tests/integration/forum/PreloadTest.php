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

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * O pré-carregamento da primeira carga (src/Preload) segue os endpoints que as
 * páginas usam: se a chave mudar de um lado só, a página faz o pedido de novo
 * e o pré-carregamento vira carga à toa.
 */
class PreloadTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    /** O Resumo do perfil já chega com o `GET /api/users/{id}/canela-summary` pronto. */
    #[Test]
    public function resumo_do_perfil_pre_carrega_o_endpoint_de_usuarios(): void
    {
        $this->extension('ramon-canela');
        $this->prepareDatabase([User::class => [$this->normalUser()]]);

        // Um navegador de verdade: robô não recebe pré-carregamento.
        $response = $this->send($this->request('GET', '/u/normal')
            ->withHeader('User-Agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'));

        $this->assertEquals(200, $response->getStatusCode());

        $html = (string) $response->getBody();

        $this->assertMatchesRegularExpression('#"canelaPreload":\{[^<]*"users\\\\?/2\\\\?/canela-summary\?"#', $html);
        $this->assertStringNotContainsString('canela-user-summary', $html);
    }
}
