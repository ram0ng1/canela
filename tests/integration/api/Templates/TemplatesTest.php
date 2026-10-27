<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Templates;

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * Os modelos do editor (`/api/canela-templates`): a lista é pública; só a
 * administração cria, muda e apaga; os campos do formulário vêm do texto; e o
 * índice que o fórum recebe em toda página (`canelaTemplates`) acompanha cada
 * gravação, com as tags.
 */
class TemplatesTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-tags', 'ramon-canela');

        $this->prepareDatabase([
            User::class => [$this->normalUser()],
            'tags' => [
                ['id' => 1, 'name' => 'Suporte', 'slug' => 'suporte', 'position' => 0],
                ['id' => 2, 'name' => 'Geral', 'slug' => 'geral', 'position' => 1],
            ],
        ]);
    }

    private function body($response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    /** O índice que o fórum recebe (`canelaTemplates`). */
    private function forumIndex(): array
    {
        $response = $this->send($this->request('GET', '/api'));

        return $this->body($response)['data']['attributes']['canelaTemplates'];
    }

    private function create(int $actor, array $attributes, array $tagIds = [])
    {
        return $this->send($this->request('POST', '/api/canela-templates', [
            'authenticatedAs' => $actor,
            'json' => ['data' => [
                'type' => 'canela-templates',
                'attributes' => $attributes,
                'relationships' => ['tags' => ['data' => array_map(static fn (int $id): array => ['type' => 'tags', 'id' => (string) $id], $tagIds)]],
            ]],
        ]));
    }

    #[Test]
    public function a_lista_e_publica_e_comeca_vazia(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-templates'));

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertSame([], $this->body($response)['data']);
        $this->assertSame([], $this->forumIndex());
    }

    #[Test]
    public function so_a_administracao_cria(): void
    {
        $response = $this->create(2, ['name' => 'Pedido', 'kind' => 'text', 'body' => 'Olá']);

        $this->assertEquals(403, $response->getStatusCode());

        $response = $this->send($this->request('POST', '/api/canela-templates', [
            'json' => ['data' => ['type' => 'canela-templates', 'attributes' => ['name' => 'Pedido', 'body' => 'Olá']]],
        ]));

        $this->assertEquals(401, $response->getStatusCode());
        $this->assertSame([], $this->forumIndex());
    }

    #[Test]
    public function o_admin_cria_com_tags_e_o_indice_do_forum_acompanha(): void
    {
        $response = $this->create(1, ['name' => '  Pedido de suporte ', 'kind' => 'text', 'body' => 'Descreva o problema.', 'required' => true, 'position' => 2], [1]);

        $this->assertEquals(201, $response->getStatusCode());

        $data = $this->body($response)['data'];

        $this->assertSame('Pedido de suporte', $data['attributes']['name']);
        $this->assertSame('text', $data['attributes']['kind']);
        $this->assertTrue($data['attributes']['required']);
        $this->assertNull($data['attributes']['fields']);
        $this->assertSame([['type' => 'tags', 'id' => '1']], $data['relationships']['tags']['data']);

        $this->assertSame([[
            'id' => (int) $data['id'],
            'name' => 'Pedido de suporte',
            'kind' => 'text',
            'required' => true,
            'tags' => [1],
        ]], $this->forumIndex());
    }

    #[Test]
    public function os_campos_do_formulario_vem_do_texto(): void
    {
        $response = $this->create(1, [
            'name' => 'Relato',
            'kind' => 'form',
            'body' => "**Versão:** {{Versão}}\n\n{{Descrição}}",
            'fields' => [
                ['key' => 'Descrição', 'label' => 'O que aconteceu', 'type' => 'textarea', 'required' => true, 'extra' => 'fora'],
                ['key' => 'Fantasma', 'label' => 'não está no texto'],
            ],
        ]);

        $this->assertEquals(201, $response->getStatusCode());

        $fields = $this->body($response)['data']['attributes']['fields'];

        $this->assertSame(['Versão', 'Descrição'], array_column($fields, 'key'));
        $this->assertSame('text', $fields[0]['type']);
        $this->assertSame('Versão', $fields[0]['label']);
        $this->assertSame('O que aconteceu', $fields[1]['label']);
        $this->assertSame('textarea', $fields[1]['type']);
        $this->assertTrue($fields[1]['required']);
        $this->assertArrayNotHasKey('extra', $fields[1]);
    }

    #[Test]
    public function nome_e_texto_sao_obrigatorios_e_o_tipo_e_conferido(): void
    {
        $this->assertEquals(422, $this->create(1, ['name' => '', 'body' => 'x'])->getStatusCode());
        $this->assertEquals(422, $this->create(1, ['name' => 'Sem texto', 'body' => ''])->getStatusCode());
        $this->assertEquals(422, $this->create(1, ['name' => 'Tipo', 'body' => 'x', 'kind' => 'carta'])->getStatusCode());
    }

    #[Test]
    public function mudar_e_apagar_refazem_o_indice(): void
    {
        $id = $this->body($this->create(1, ['name' => 'Pedido', 'kind' => 'text', 'body' => 'Olá'], [1]))['data']['id'];

        $response = $this->send($this->request('PATCH', "/api/canela-templates/$id", [
            'authenticatedAs' => 1,
            'json' => ['data' => [
                'type' => 'canela-templates',
                'id' => $id,
                'attributes' => ['name' => 'Pedido geral'],
                'relationships' => ['tags' => ['data' => [['type' => 'tags', 'id' => '2']]]],
            ]],
        ]));

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertSame('Pedido geral', $this->forumIndex()[0]['name']);
        $this->assertSame([2], $this->forumIndex()[0]['tags']);

        $response = $this->send($this->request('PATCH', "/api/canela-templates/$id", [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-templates', 'id' => $id, 'attributes' => ['name' => 'Invasão']]],
        ]));

        $this->assertEquals(403, $response->getStatusCode());

        $this->assertEquals(403, $this->send($this->request('DELETE', "/api/canela-templates/$id", ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(204, $this->send($this->request('DELETE', "/api/canela-templates/$id", ['authenticatedAs' => 1]))->getStatusCode());
        $this->assertSame([], $this->forumIndex());
        $this->assertEquals(404, $this->send($this->request('GET', "/api/canela-templates/$id"))->getStatusCode());
    }

    #[Test]
    public function desligado_no_admin_tudo_e_404(): void
    {
        $this->setting('canela.templates_enabled', '0');

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-templates'))->getStatusCode());
        $this->assertEquals(404, $this->create(1, ['name' => 'Pedido', 'body' => 'Olá'])->getStatusCode());
    }
}
