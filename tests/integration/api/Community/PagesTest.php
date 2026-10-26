<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Community;

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * As páginas institucionais: "Sobre" (/api/canela-about e /about), as
 * "Diretrizes" (/api/canela-guidelines, /guidelines e /faq) e os atalhos
 * /tos e /privacy para as políticas.
 */
class PagesTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'moderadora', 'email' => 'mod@machine.local', 'is_email_confirmed' => 1],
            ],
            'group_user' => [
                ['user_id' => 3, 'group_id' => 4],
            ],
        ]);
    }

    private function body(ResponseInterface $response): array
    {
        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return json_decode((string) $response->getBody(), true);
    }

    /**
     * O "Sobre" traz o texto do admin (texto puro passa pelo formatador e
     * vira HTML escapado), o contato, a
     * equipe e as estatísticas, também para visitantes.
     */
    #[Test]
    public function sobre_traz_texto_contato_e_equipe(): void
    {
        $this->setting('canela.about_text', 'Somos um fórum de teste & amigos.');
        $this->setting('canela.about_contact_email', 'contato@example.com');

        $body = $this->body($this->send($this->request('GET', '/api/canela-about')));

        $this->assertStringContainsString('Somos um fórum de teste &amp; amigos.', $body['aboutHtml']);
        $this->assertSame('contato@example.com', $body['contactEmail']);
        $this->assertSame(['1'], $body['admins']);
        $this->assertSame(['3'], $body['moderators']);
        $this->assertSame(3, $body['members']);
        $this->assertIsArray($body['stats']);
    }

    /**
     * Texto do admin com tags HTML vai como está (o admin é dono do HTML).
     */
    #[Test]
    public function sobre_aceita_html_do_admin(): void
    {
        $this->setting('canela.about_text', '<p class="x">Olá</p>');

        $this->assertSame('<p class="x">Olá</p>', $this->body($this->send($this->request('GET', '/api/canela-about')))['aboutHtml']);
    }

    /**
     * Equipe e estatísticas escondidas no admin saem como nulas.
     */
    #[Test]
    public function sobre_sem_equipe_e_sem_estatisticas(): void
    {
        $this->setting('canela.about_show_staff', false);
        $this->setting('canela.about_show_stats', false);

        $body = $this->body($this->send($this->request('GET', '/api/canela-about')));

        $this->assertNull($body['admins']);
        $this->assertNull($body['moderators']);
        $this->assertNull($body['stats']);
        $this->assertSame([], $body['included']);
    }

    /**
     * "Sobre" desligado: a API e a página /about respondem 404.
     */
    #[Test]
    public function sobre_desligado_responde_404(): void
    {
        $this->setting('canela.about_enabled', false);

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-about'))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/about'))->getStatusCode());
    }

    /**
     * Fórum fechado a visitantes: o "Sobre" também fecha.
     */
    #[Test]
    public function sobre_em_forum_fechado_exige_login(): void
    {
        $this->database()->table('group_permission')->where('permission', 'viewForum')->where('group_id', 2)->delete();
        $this->database()->table('group_permission')->insert(['permission' => 'viewForum', 'group_id' => 3]);

        $this->assertContains($this->send($this->request('GET', '/api/canela-about'))->getStatusCode(), [401, 403]);
        $this->assertEquals(200, $this->send($this->request('GET', '/api/canela-about', ['authenticatedAs' => 2]))->getStatusCode());
    }

    /**
     * As diretrizes vêm desligadas: 404 na API e nas páginas.
     */
    #[Test]
    public function diretrizes_desligadas_por_padrao(): void
    {
        $this->setting('canela.guidelines_text', 'Seja gentil.');

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-guidelines'))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/guidelines'))->getStatusCode());
    }

    /**
     * Ligadas e com texto, as diretrizes saem em HTML e a página abre.
     */
    #[Test]
    public function diretrizes_ligadas_com_texto(): void
    {
        $this->setting('canela.guidelines_enabled', true);
        $this->setting('canela.guidelines_text', 'Seja gentil <3');

        $body = $this->body($this->send($this->request('GET', '/api/canela-guidelines')));

        $this->assertTrue($body['custom']);
        $this->assertStringContainsString('Seja gentil &lt;3', $body['html']);
        $this->assertEquals(200, $this->send($this->request('GET', '/guidelines'))->getStatusCode());
        $this->assertEquals(200, $this->send($this->request('GET', '/faq'))->getStatusCode());

        $forum = $this->body($this->send($this->request('GET', '/api')));
        $this->assertTrue($forum['data']['attributes']['canelaGuidelinesEnabled']);
    }

    /**
     * Ligadas mas sem conteúdo, as diretrizes não existem (nada de texto padrão).
     */
    #[Test]
    public function diretrizes_ligadas_sem_texto_respondem_404(): void
    {
        $this->setting('canela.guidelines_enabled', true);

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-guidelines'))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/guidelines'))->getStatusCode());

        $forum = $this->body($this->send($this->request('GET', '/api')));
        $this->assertFalse($forum['data']['attributes']['canelaGuidelinesEnabled']);
    }

    /**
     * Criar a página de diretrizes no fof/pages é só para admin.
     */
    #[Test]
    public function criar_pagina_de_diretrizes_so_admin(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-guidelines/page', ['authenticatedAs' => 2, 'json' => []]));

        $this->assertEquals(403, $response->getStatusCode());

        // Sem o fof/pages, nem o admin cria: 422.
        $response = $this->send($this->request('POST', '/api/canela-guidelines/page', ['authenticatedAs' => 1, 'json' => []]));

        $this->assertEquals(422, $response->getStatusCode());
    }

    /**
     * Sem endereço configurado, /tos e /privacy não existem: 404.
     */
    #[Test]
    public function politicas_sem_endereco_respondem_404(): void
    {
        $this->assertEquals(404, $this->send($this->request('GET', '/tos'))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/privacy'))->getStatusCode());
    }

    /**
     * /tos e /privacy levam ao endereço configurado (URL completa ou caminho
     * do próprio fórum), e as abas chegam ao fórum.
     */
    #[Test]
    public function atalhos_das_politicas(): void
    {
        $this->setting('canela.tos_url', 'https://example.com/termos');
        $this->setting('canela.privacy_url', '/privacidade');

        $response = $this->send($this->request('GET', '/tos'));
        $this->assertEquals(302, $response->getStatusCode());
        $this->assertSame('https://example.com/termos', $response->getHeaderLine('Location'));

        $response = $this->send($this->request('GET', '/privacy'));
        $this->assertEquals(302, $response->getStatusCode());
        $this->assertSame('/privacidade', $response->getHeaderLine('Location'));

        $legal = $this->body($this->send($this->request('GET', '/api')))['data']['attributes']['canelaLegalPages'];
        $this->assertSame(['tos', 'privacy'], array_column($legal, 'key'));
    }

    /**
     * Endereço que não é URL (javascript:, texto solto) é ignorado: 404.
     */
    #[Test]
    public function endereco_invalido_da_politica_e_ignorado(): void
    {
        $this->setting('canela.tos_url', 'javascript:alert(1)');

        $this->assertEquals(404, $this->send($this->request('GET', '/tos'))->getStatusCode());
    }
}
