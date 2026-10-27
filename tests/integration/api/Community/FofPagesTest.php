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

use Carbon\Carbon;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use FoF\Pages\Events\PageCreated;
use FoF\Pages\Page;
use Illuminate\Contracts\Events\Dispatcher;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * As páginas de comunidade com o fof/pages: a página "Diretrizes" criada
 * pelo admin (idempotente, com endereço único e o PageCreated) e a
 * visibilidade do fof/pages no link das Diretrizes e nas abas extras do Sobre.
 */
class FofPagesTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('fof-pages', 'ramon-canela');

        $page = fn (int $id, string $slug, array $extra = []) => $extra + [
            'id' => $id, 'title' => "Página $id", 'slug' => $slug, 'content' => '<t><p>Conteúdo</p></t>',
            'created_at' => Carbon::now(), 'is_hidden' => 0, 'is_restricted' => 0, 'is_html' => 0,
        ];

        $this->prepareDatabase([
            User::class => [$this->normalUser()],
            'pages' => [
                // Uma página já com o endereço que a criação usaria.
                $page(1, 'guidelines'),
                $page(2, 'oculta', ['is_hidden' => 1]),
                $page(3, 'equipe'),
            ],
        ]);
    }

    private function body(ResponseInterface $response): array
    {
        $this->assertContains($response->getStatusCode(), [200, 201], (string) $response->getBody());

        return json_decode((string) $response->getBody(), true);
    }

    private function createGuidelines(): ResponseInterface
    {
        return $this->send($this->request('POST', '/api/canela-about-pages/guidelines', ['authenticatedAs' => 1, 'json' => []]));
    }

    /**
     * Criar as Diretrizes: endereço livre (o `guidelines` já é de outra
     * página), o PageCreated com o admin como ator e, pedindo de novo, a
     * mesma página em vez de uma segunda.
     */
    #[Test]
    public function criar_diretrizes_e_idempotente_com_endereco_unico(): void
    {
        $this->app();
        $events = [];
        $this->app()->getContainer()->make(Dispatcher::class)->listen(PageCreated::class, function (PageCreated $event) use (&$events): void {
            $events[] = $event;
        });

        $first = $this->createGuidelines();
        $this->assertEquals(201, $first->getStatusCode(), (string) $first->getBody());
        $this->assertSame('canela-about-pages', $this->body($first)['data']['type']);
        $id = (int) $this->body($first)['data']['id'];

        $page = Page::query()->find($id);
        $this->assertSame('guidelines-2', $page->slug);
        $this->assertCount(1, $events);
        $this->assertSame($id, (int) $events[0]->page->id);
        $this->assertSame(1, (int) $events[0]->actor->id);

        $second = $this->createGuidelines();
        $this->assertEquals(200, $second->getStatusCode(), (string) $second->getBody());
        $this->assertSame($id, (int) $this->body($second)['data']['id']);
        $this->assertCount(1, $events);
        $this->assertSame(4, Page::query()->count());
    }

    /**
     * A página escolhida apagada no fof/pages: criar de novo faz outra.
     */
    #[Test]
    public function criar_de_novo_quando_a_escolhida_sumiu(): void
    {
        $this->setting('canela.guidelines_page', '99');

        $response = $this->createGuidelines();

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());
        $this->assertNotSame(99, (int) $this->body($response)['data']['id']);
    }

    /**
     * Diretrizes apontando para uma página oculta: para quem não a vê, o
     * link some do fórum e o /guidelines é 404; o admin vê os dois.
     */
    #[Test]
    public function diretrizes_em_pagina_oculta_seguem_a_visibilidade(): void
    {
        $this->setting('canela.guidelines_enabled', true);
        $this->setting('canela.guidelines_page', '2');

        $member = $this->body($this->send($this->request('GET', '/api', ['authenticatedAs' => 2])));
        $this->assertFalse($member['data']['attributes']['canelaGuidelinesEnabled']);
        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-guidelines', ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/guidelines', ['authenticatedAs' => 2]))->getStatusCode());

        $admin = $this->body($this->send($this->request('GET', '/api', ['authenticatedAs' => 1])));
        $this->assertTrue($admin['data']['attributes']['canelaGuidelinesEnabled']);
        $this->assertEquals(200, $this->send($this->request('GET', '/api/canela-guidelines', ['authenticatedAs' => 1]))->getStatusCode());
    }

    /**
     * Diretrizes numa página visível: o link aparece para todos.
     */
    #[Test]
    public function diretrizes_em_pagina_visivel(): void
    {
        $this->setting('canela.guidelines_enabled', true);
        $this->setting('canela.guidelines_page', '3');

        $guest = $this->body($this->send($this->request('GET', '/api')));
        $this->assertTrue($guest['data']['attributes']['canelaGuidelinesEnabled']);
    }

    /**
     * As abas extras do Sobre funcionam com o Sobre ligado.
     */
    #[Test]
    public function abas_extras_do_sobre(): void
    {
        $this->setting('canela.about_pages', json_encode([['id' => 3, 'label' => '', 'icon' => '']]));

        $this->assertSame([3], array_column($this->body($this->send($this->request('GET', '/api')))['data']['attributes']['canelaAboutPages'], 'id'));
        $this->assertEquals(200, $this->send($this->request('GET', '/api/canela-about-pages/3'))->getStatusCode());
        $this->assertEquals(200, $this->send($this->request('GET', '/about/3-equipe'))->getStatusCode());
    }

    /**
     * Com o Sobre desligado, as abas extras somem junto: lista vazia no
     * fórum e 404 na API e no /about/{id}.
     */
    #[Test]
    public function abas_extras_somem_com_o_sobre_desligado(): void
    {
        $this->setting('canela.about_enabled', false);
        $this->setting('canela.about_pages', json_encode([['id' => 3, 'label' => '', 'icon' => '']]));

        $this->assertSame([], $this->body($this->send($this->request('GET', '/api')))['data']['attributes']['canelaAboutPages']);
        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-about-pages/3'))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/about/3-equipe'))->getStatusCode());
    }
    /**
     * A aba extra pela API: o HTML, o título e o rótulo do admin. Só as
     * páginas da lista e com a visibilidade do fof/pages: a oculta só para o
     * admin, e uma fora da lista é 404 até para ele.
     */
    #[Test]
    public function aba_extra_segue_a_lista_e_a_visibilidade(): void
    {
        $this->setting('canela.about_pages', json_encode([['id' => 3, 'label' => 'Quem somos', 'icon' => ''], ['id' => 2, 'label' => '', 'icon' => '']]));

        $page = $this->body($this->send($this->request('GET', '/api/canela-about-pages/3')));

        $this->assertSame('canela-about-pages', $page['data']['type']);
        $this->assertSame('3', $page['data']['id']);
        $this->assertSame('Quem somos', $page['data']['attributes']['label']);
        $this->assertSame('Página 3', $page['data']['attributes']['title']);
        $this->assertStringContainsString('Conteúdo', $page['data']['attributes']['html']);

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-about-pages/2', ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(200, $this->send($this->request('GET', '/api/canela-about-pages/2', ['authenticatedAs' => 1]))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-about-pages/1', ['authenticatedAs' => 1]))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-about-pages/equipe', ['authenticatedAs' => 1]))->getStatusCode());
    }

    /** Criar as Diretrizes é só do admin: membro recebe 403 e nada é criado. */
    #[Test]
    public function membro_nao_cria_diretrizes(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-about-pages/guidelines', ['authenticatedAs' => 2, 'json' => []]));

        $this->assertEquals(403, $response->getStatusCode());
        $this->assertSame(3, Page::query()->count());
    }
}
