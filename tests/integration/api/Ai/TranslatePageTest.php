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

namespace Ramon\Canela\Tests\integration\api\Ai;

use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Tests\integration\api\Ai\Fake\FakeLlm;

/**
 * As páginas da área Sobre no idioma de quem lê (`/api/canela/ai/translate-page`):
 * só os textos vão ao modelo, em JSON, e voltam para o mesmo HTML; a
 * tradução fica guardada (a segunda leitura não chama o modelo) e a página
 * que a pessoa não vê é 404.
 */
class TranslatePageTest extends AbstractAiTestCase
{
    private const HTML = '<p>Ao criar uma conta ou usar este site, você concorda com estes termos e com as diretrizes da comunidade.</p><h2>1. Conta</h2><p>Você é responsável pela segurança da sua conta. Use o <code>código</code> recebido.</p>';

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('fof-pages', 'ramon-canela');
        $this->setting(AiSettings::TRANSLATION, '1');
        $this->setting('canela.about_pages', json_encode([['id' => 3, 'label' => '', 'icon' => '']]));

        $page = fn (int $id, array $extra = []) => $extra + [
            'id' => $id, 'title' => 'Termos de Uso', 'slug' => 'termos', 'content' => '<t>'.htmlspecialchars(self::HTML).'</t>',
            'created_at' => Carbon::now(), 'is_hidden' => 0, 'is_restricted' => 0, 'is_html' => 1,
        ];

        $this->prepareDatabase(['pages' => [$page(3), $page(4, ['slug' => 'oculta', 'is_hidden' => 1])]]);
    }

    private function translate(string $source, int $as = 2)
    {
        return $this->send($this->request('POST', '/api/canela/ai/translate-page', ['authenticatedAs' => $as, 'json' => ['source' => $source]]));
    }

    #[Test]
    public function a_pagina_e_traduzida_so_pelos_textos(): void
    {
        FakeLlm::queue(json_encode([
            'title' => 'Terms of Use',
            't0' => 'By creating an account or using this site, you agree to these terms and to the community guidelines.',
            't1' => '1. Account',
            't2' => 'You are responsible for the security of your account. Use the ',
            't3' => '<script>alert(1)</script> received.',
        ]));

        $response = $this->translate('page:3');
        $body = $this->body($response);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame('Terms of Use', $body['title']);
        $this->assertSame('pt', $body['locale']);
        $this->assertStringContainsString('<h2>1. Account</h2>', $body['html']);
        // O código não vai ao modelo, e o que o modelo devolve é texto, nunca HTML.
        $this->assertStringContainsString('<code>código</code>', $body['html']);
        $this->assertStringContainsString('&lt;script&gt;', $body['html']);
        $this->assertStringNotContainsString('<script>', $body['html']);
        $this->assertCount(1, FakeLlm::$requests);
        $this->assertStringNotContainsString('código', FakeLlm::$requests[0]->messages[0]['content']);

        // Guardada: a segunda leitura não chama o modelo.
        $this->assertSame($body, $this->body($this->translate('page:3')));
        $this->assertCount(1, FakeLlm::$requests);
    }

    #[Test]
    public function so_paginas_da_area_sobre_e_visiveis(): void
    {
        $this->assertEquals(404, $this->translate('page:4')->getStatusCode(), 'fora da lista e oculta');
        $this->assertEquals(404, $this->translate('page:99')->getStatusCode());
        $this->assertEquals(404, $this->translate('/etc/passwd')->getStatusCode());
        $this->assertSame([], FakeLlm::$requests);
    }
}
