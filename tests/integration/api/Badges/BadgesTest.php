<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Badges;

use Carbon\Carbon;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Badges\Badge;

/**
 * Emblemas (`/api/canela-badges`): a vitrine pública mostra só os ligados,
 * listáveis e que o fórum consegue conceder; criar, editar e remover é do
 * admin, com as regras de validação do recurso.
 */
class BadgesTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [$this->normalUser()],
            'canela_badges' => [
                self::badge(100, 'Pioneiro'),
                self::badge(101, 'Desligado', ['enabled' => false]),
                self::badge(102, 'Escondido', ['listable' => false]),
            ],
        ]);
    }

    /** Um emblema personalizado, com os padrões do admin. */
    public static function badge(int $id, string $name, array $overrides = []): array
    {
        return array_merge([
            'id' => $id,
            'slug' => 'custom-'.$id,
            'name' => $name,
            'description' => "Descrição de $name",
            'icon' => 'fas fa-star',
            'type' => 'gold',
            'grouping' => 'other',
            'position' => 1000 + $id,
            'multiple_grant' => false,
            'enabled' => true,
            'listable' => true,
            'system' => false,
            'manual_grant' => true,
            'allow_title' => false,
            'created_at' => Carbon::now(),
        ], $overrides);
    }

    private function body($response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    private function names($response): array
    {
        return array_column(array_column($this->body($response)['data'], 'attributes'), 'name');
    }

    /**
     * Visitante vê a vitrine: só os ligados e listáveis, e nenhum emblema que
     * o fórum não consegue conceder (Primeira curtida sem o flarum/likes).
     */
    #[Test]
    public function vitrine_publica_mostra_so_os_disponiveis(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-badges'));

        $this->assertEquals(200, $response->getStatusCode());

        $slugs = array_column(array_column($this->body($response)['data'], 'attributes'), 'slug');

        $this->assertContains('custom-100', $slugs);
        $this->assertContains('editor', $slugs);
        $this->assertNotContains('custom-101', $slugs);
        $this->assertNotContains('custom-102', $slugs);
        $this->assertNotContains('first_like', $slugs);
    }

    /** Com o flarum/likes ligado, os emblemas de curtida entram na vitrine. */
    #[Test]
    public function emblemas_de_curtida_aparecem_com_likes(): void
    {
        $this->extension('flarum-likes', 'ramon-canela');

        $response = $this->send($this->request('GET', '/api/canela-badges'));

        $slugs = array_column(array_column($this->body($response)['data'], 'attributes'), 'slug');

        $this->assertContains('first_like', $slugs);
    }

    /** O admin vê todos, inclusive desligados, com os campos de administração. */
    #[Test]
    public function admin_ve_todos_os_emblemas(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-badges', ['authenticatedAs' => 1]));

        $this->assertEquals(200, $response->getStatusCode());

        $data = collect($this->body($response)['data'])->keyBy('id');

        $this->assertTrue($data->has('101'));
        $this->assertTrue($data->has('102'));
        $this->assertArrayHasKey('canGrant', $data['100']['attributes']);
        $this->assertTrue($data['100']['attributes']['canGrant']);
    }

    /** Um emblema desligado não existe para quem não é admin (404). */
    #[Test]
    public function emblema_desligado_responde_404_para_usuario(): void
    {
        $user = $this->send($this->request('GET', '/api/canela-badges/101', ['authenticatedAs' => 2]));
        $admin = $this->send($this->request('GET', '/api/canela-badges/101', ['authenticatedAs' => 1]));

        $this->assertEquals(404, $user->getStatusCode());
        $this->assertEquals(200, $admin->getStatusCode());
    }

    /** Não listável sai da vitrine, mas a página do emblema abre, com a descrição longa. */
    #[Test]
    public function nao_listavel_abre_na_pagina_do_emblema(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-badges/102', ['authenticatedAs' => 2]));

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertArrayHasKey('longDescription', $this->body($response)['data']['attributes']);
        $this->assertArrayNotHasKey('canGrant', $this->body($response)['data']['attributes']);
    }

    /** Desligado no admin, o recurso some (404) — menos para o admin. */
    #[Test]
    public function recurso_desligado_responde_404_menos_para_admin(): void
    {
        $this->setting('canela.badges_enabled', '0');

        $user = $this->send($this->request('GET', '/api/canela-badges', ['authenticatedAs' => 2]));
        $admin = $this->send($this->request('GET', '/api/canela-badges', ['authenticatedAs' => 1]));

        $this->assertEquals(404, $user->getStatusCode());
        $this->assertEquals(200, $admin->getStatusCode());
    }

    /** O admin cria um emblema personalizado: slug gerado do nome, no fim da lista. */
    #[Test]
    public function admin_cria_emblema(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-badges', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'canela-badges', 'attributes' => [
                'name' => '  Caçador de Bugs ',
                'description' => 'Achou um bug',
                'icon' => 'fas fa-bug',
                'type' => 'silver',
                'grouping' => 'community',
            ]]],
        ]));

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        $attributes = $this->body($response)['data']['attributes'];

        $this->assertEquals('Caçador de Bugs', $attributes['name']);
        $this->assertEquals('cacador-de-bugs', $attributes['slug']);
        $this->assertFalse($attributes['system']);
        $this->assertTrue($attributes['enabled']);

        $badge = Badge::query()->where('slug', 'cacador-de-bugs')->firstOrFail();

        $this->assertEquals((int) Badge::query()->max('position'), $badge->position);
    }

    /** Usuário comum não cria, não edita e não apaga emblemas (403). */
    #[Test]
    public function usuario_nao_administra_emblemas(): void
    {
        $create = $this->send($this->request('POST', '/api/canela-badges', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-badges', 'attributes' => ['name' => 'Hacker']]],
        ]));
        $update = $this->send($this->request('PATCH', '/api/canela-badges/100', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-badges', 'id' => '100', 'attributes' => ['name' => 'Hacker']]],
        ]));
        $delete = $this->send($this->request('DELETE', '/api/canela-badges/100', ['authenticatedAs' => 2]));

        $this->assertEquals(403, $create->getStatusCode());
        $this->assertEquals(403, $update->getStatusCode());
        $this->assertEquals(403, $delete->getStatusCode());
        $this->assertEquals('Pioneiro', Badge::query()->find(100)->name);
        $this->assertNull(Badge::query()->where('name', 'Hacker')->first());
    }

    /** Sem nome, com ícone, tipo ou agrupamento fora do permitido: 422. */
    #[Test]
    public function validacao_ao_criar(): void
    {
        $send = fn (array $attributes) => $this->send($this->request('POST', '/api/canela-badges', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'canela-badges', 'attributes' => $attributes]],
        ]))->getStatusCode();

        $this->assertEquals(422, $send(['description' => 'Sem nome']));
        $this->assertEquals(422, $send(['name' => 'Ícone ruim', 'icon' => '<script>']));
        $this->assertEquals(422, $send(['name' => 'Tipo ruim', 'type' => 'platinum']));
        $this->assertEquals(422, $send(['name' => 'Grupo ruim', 'grouping' => 'nada']));
        $this->assertEquals(422, $send(['name' => 'Imagem ruim', 'imageUrl' => 'javascript:alert(1)']));
    }

    /**
     * Um nome só de espaços não é um nome: depois de aparado ficaria vazio, e
     * o emblema apareceria sem título na vitrine e na notificação. Deve ser
     * recusado (422), como um nome ausente.
     *
     * Na criação o `requiredOnCreate()` já barrava; na edição o `minLength(1)`
     * validava o texto antes do `trim()` do `set()` — agora a regra pede um
     * caractere que não seja espaço.
     */
    #[Test]
    public function nome_so_de_espacos_e_recusado(): void
    {
        $create = $this->send($this->request('POST', '/api/canela-badges', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'canela-badges', 'attributes' => ['name' => '   ']]],
        ]));
        $update = $this->send($this->request('PATCH', '/api/canela-badges/100', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'canela-badges', 'id' => '100', 'attributes' => ['name' => '   ']]],
        ]));

        $this->assertEquals(422, $create->getStatusCode());
        $this->assertEquals(422, $update->getStatusCode());
        $this->assertEquals('Pioneiro', Badge::query()->find(100)->name);
        $this->assertNull(Badge::query()->where('name', '')->first());
    }

    /** Dois emblemas com o mesmo nome confundiriam a página: 422. */
    #[Test]
    public function nome_repetido_e_recusado(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-badges', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'canela-badges', 'attributes' => ['name' => 'Pioneiro']]],
        ]));

        $this->assertEquals(422, $response->getStatusCode());
        $this->assertEquals(1, Badge::query()->where('name', 'Pioneiro')->count());
    }

    /** O admin edita um emblema; o slug não se edita. */
    #[Test]
    public function admin_edita_emblema(): void
    {
        $response = $this->send($this->request('PATCH', '/api/canela-badges/100', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'canela-badges', 'id' => '100', 'attributes' => [
                'name' => 'Pioneira',
                'enabled' => false,
                'description' => '   ',
            ]]],
        ]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $badge = Badge::query()->find(100);

        $this->assertEquals('Pioneira', $badge->name);
        $this->assertFalse($badge->enabled);
        $this->assertNull($badge->description);
        $this->assertEquals('custom-100', $badge->slug);
    }

    /** Remover um emblema do sistema deixa a marca, para a semente não recriá-lo. */
    #[Test]
    public function remover_emblema_do_sistema_deixa_a_marca(): void
    {
        $this->app();
        $editor = Badge::query()->where('slug', 'editor')->firstOrFail();

        $response = $this->send($this->request('DELETE', '/api/canela-badges/'.$editor->id, ['authenticatedAs' => 1]));

        $this->assertEquals(204, $response->getStatusCode());
        $this->assertNull(Badge::query()->find($editor->id));

        $removed = $this->database()->table('settings')->where('key', 'canela.badges_removed_system')->value('value');

        $this->assertContains('editor', json_decode((string) $removed, true));
    }

    /** "Restaurar emblemas do sistema" recria o removido (só o admin). */
    #[Test]
    public function restaurar_emblemas_do_sistema(): void
    {
        $this->app();
        $editor = Badge::query()->where('slug', 'editor')->firstOrFail();
        $this->send($this->request('DELETE', '/api/canela-badges/'.$editor->id, ['authenticatedAs' => 1]));

        $user = $this->send($this->request('POST', '/api/canela-badges/restore-system', ['authenticatedAs' => 2]));
        $admin = $this->send($this->request('POST', '/api/canela-badges/restore-system', ['authenticatedAs' => 1]));

        $this->assertEquals(403, $user->getStatusCode());
        $this->assertEquals(200, $admin->getStatusCode(), (string) $admin->getBody());
        $this->assertEquals(1, $this->body($admin)['meta']['restored']);
        $this->assertNotNull(Badge::query()->where('slug', 'editor')->first());
    }

    /** O que o fórum consegue medir só vai no payload do admin. */
    #[Test]
    public function capacidades_so_para_o_admin(): void
    {
        $guest = $this->body($this->send($this->request('GET', '/api')))['data']['attributes'];
        $admin = $this->body($this->send($this->request('GET', '/api', ['authenticatedAs' => 1])))['data']['attributes'];

        $this->assertArrayNotHasKey('canelaBadgesCapabilities', $guest);
        $this->assertArrayHasKey('canelaBadgesCapabilities', $admin);
        $this->assertTrue($guest['canelaBadgesEnabled']);
        $this->assertTrue($guest['canelaTrustLevelsEnabled']);
    }
}
