<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Bookmarks;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Illuminate\Database\Events\QueryExecuted;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Bookmarks\Bookmark;

/**
 * Marcadores (`/api/canela-bookmarks`): pessoais, só do dono, com nome e
 * lembrete, e o estado do marcador do ator exposto nos posts.
 */
class BookmarksTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outro', 'email' => 'outro@machine.local', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Tópico público', 'user_id' => 2, 'first_post_id' => 1, 'comment_count' => 2, 'last_post_number' => 2],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Primeiro post</p></t>', 'number' => 1],
                ['id' => 2, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>Resposta com banana</p></t>', 'number' => 2],
                // Oculto: só o autor e a moderação veem.
                ['id' => 3, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>Oculto</p></t>', 'number' => 3, 'hidden_at' => Carbon::now(), 'hidden_user_id' => 1],
            ],
            Bookmark::class => [
                ['id' => 1, 'user_id' => 2, 'post_id' => 1, 'name' => 'Meu marcador', 'created_at' => Carbon::now()->subDay(), 'updated_at' => Carbon::now()->subDay()],
                ['id' => 2, 'user_id' => 3, 'post_id' => 1, 'name' => 'Do outro', 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
            ],
        ]);
    }

    private function body($response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    /** Visitante não tem marcadores: listar pede login. */
    #[Test]
    public function visitante_nao_lista_marcadores(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-bookmarks'));

        $this->assertEquals(401, $response->getStatusCode());
    }

    /**
     * Visitante também não marca posts. Sem sessão o POST já para na
     * verificação de CSRF (400) antes do 401 do recurso; o que importa é que
     * nada é gravado.
     */
    #[Test]
    public function visitante_nao_cria_marcador(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-bookmarks', [
            'json' => ['data' => ['type' => 'canela-bookmarks', 'relationships' => ['post' => ['data' => ['type' => 'posts', 'id' => '2']]]]],
        ]));

        $this->assertContains($response->getStatusCode(), [400, 401]);
        $this->assertEquals(0, Bookmark::query()->where('post_id', 2)->count());
    }

    /** A lista traz só os marcadores do próprio ator, com o post incluído. */
    #[Test]
    public function lista_so_os_marcadores_do_ator(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-bookmarks', ['authenticatedAs' => 2]));

        $this->assertEquals(200, $response->getStatusCode());

        $body = $this->body($response);

        $this->assertEquals(['1'], array_column($body['data'], 'id'));
        $this->assertEquals('Meu marcador', $body['data'][0]['attributes']['name']);
        $this->assertContains('posts', array_column($body['included'], 'type'));
    }

    /** O filtro `q` procura no nome do marcador e no conteúdo do post. */
    #[Test]
    public function filtro_q_busca_no_nome_e_no_conteudo(): void
    {
        $this->prepareDatabase([
            Bookmark::class => [
                ['id' => 3, 'user_id' => 2, 'post_id' => 2, 'name' => null, 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
            ],
        ]);

        $response = $this->send($this->request('GET', '/api/canela-bookmarks', ['authenticatedAs' => 2])
            ->withQueryParams(['filter' => ['q' => 'BANANA']]));

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals(['3'], array_column($this->body($response)['data'], 'id'));
    }

    /** Marcar um post grava o marcador no nome do ator, com nome aparado. */
    #[Test]
    public function usuario_marca_um_post(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-bookmarks', [
            'authenticatedAs' => 2,
            'json' => ['data' => [
                'type' => 'canela-bookmarks',
                'attributes' => ['name' => '  Ler depois  '],
                'relationships' => ['post' => ['data' => ['type' => 'posts', 'id' => '2']]],
            ]],
        ]));

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        $bookmark = Bookmark::query()->where('user_id', 2)->where('post_id', 2)->first();

        $this->assertNotNull($bookmark);
        $this->assertEquals('Ler depois', $bookmark->name);
        $this->assertEquals('Ler depois', $this->body($response)['data']['attributes']['name']);
    }

    /** Marcar de novo o mesmo post reaproveita o marcador (sem erro de índice único). */
    #[Test]
    public function marcar_de_novo_reaproveita_o_marcador(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-bookmarks', [
            'authenticatedAs' => 2,
            'json' => ['data' => [
                'type' => 'canela-bookmarks',
                'attributes' => ['name' => 'Nome novo'],
                'relationships' => ['post' => ['data' => ['type' => 'posts', 'id' => '1']]],
            ]],
        ]));

        $this->assertContains($response->getStatusCode(), [200, 201], (string) $response->getBody());
        $this->assertEquals('1', $this->body($response)['data']['id']);
        $this->assertEquals(1, Bookmark::query()->where('user_id', 2)->where('post_id', 1)->count());
        $this->assertEquals('Nome novo', Bookmark::query()->find(1)->name);
    }

    /**
     * Dois POSTs simultâneos do mesmo marcador: o segundo passa pela checagem
     * antes do primeiro gravar e bate no índice único. Simulado gravando a
     * linha "da outra requisição" logo antes do INSERT — a resposta é o
     * marcador existente, com o nome novo, e não um 500.
     */
    #[Test]
    public function marcar_ao_mesmo_tempo_nao_quebra_no_indice_unico(): void
    {
        // A "outra aba" grava logo depois da checagem do `creating()` (o
        // SELECT do marcador existente) e antes do INSERT desta.
        $db = $this->database();
        $raced = false;
        $db->listen(function (QueryExecuted $query) use ($db, &$raced): void {
            if (! $raced && str_starts_with(strtolower($query->sql), 'select') && str_contains($query->sql, 'canela_bookmarks') && str_contains($query->sql, 'post_id')) {
                $raced = true;
                $db->table('canela_bookmarks')->insert(['id' => 50, 'user_id' => 2, 'post_id' => 2, 'name' => 'Da outra aba', 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()]);
            }
        });

        $response = $this->send($this->request('POST', '/api/canela-bookmarks', [
            'authenticatedAs' => 2,
            'json' => ['data' => [
                'type' => 'canela-bookmarks',
                'attributes' => ['name' => 'Desta aba'],
                'relationships' => ['post' => ['data' => ['type' => 'posts', 'id' => '2']]],
            ]],
        ]));

        $this->assertContains($response->getStatusCode(), [200, 201], (string) $response->getBody());
        $this->assertEquals('50', $this->body($response)['data']['id']);
        $this->assertEquals(1, Bookmark::query()->where('user_id', 2)->where('post_id', 2)->count());
        $this->assertTrue($raced);
        $this->assertEquals('Desta aba', Bookmark::query()->find(50)->name);
    }

    /**
     * Apagar o post apaga os marcadores dele — também no SQLite, onde a
     * cascata da chave estrangeira não roda sem o PRAGMA.
     */
    #[Test]
    public function apagar_o_post_apaga_os_marcadores(): void
    {
        $this->prepareDatabase([
            Bookmark::class => [
                ['id' => 3, 'user_id' => 2, 'post_id' => 2, 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
            ],
        ]);

        $response = $this->send($this->request('DELETE', '/api/posts/2', ['authenticatedAs' => 1]));

        $this->assertEquals(204, $response->getStatusCode(), (string) $response->getBody());
        $this->assertEquals(0, Bookmark::query()->where('post_id', 2)->count());
        $this->assertEquals(2, Bookmark::query()->where('post_id', 1)->count());
    }

    /** Sem o post, o marcador não é criado (422). */
    #[Test]
    public function criar_sem_post_e_invalido(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-bookmarks', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-bookmarks', 'attributes' => ['name' => 'x']]],
        ]));

        $this->assertEquals(422, $response->getStatusCode());
    }

    /** Lembrete no passado nunca seria enviado: 422. */
    #[Test]
    public function lembrete_no_passado_e_invalido(): void
    {
        $response = $this->send($this->request('PATCH', '/api/canela-bookmarks/1', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-bookmarks', 'id' => '1', 'attributes' => ['reminderAt' => Carbon::now()->subDay()->toIso8601String()]]],
        ]));

        $this->assertEquals(422, $response->getStatusCode());
    }

    /** Nome acima de 100 caracteres: 422. */
    #[Test]
    public function nome_longo_demais_e_invalido(): void
    {
        $response = $this->send($this->request('PATCH', '/api/canela-bookmarks/1', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-bookmarks', 'id' => '1', 'attributes' => ['name' => str_repeat('a', 101)]]],
        ]));

        $this->assertEquals(422, $response->getStatusCode());
    }

    /** O dono troca o nome e define um lembrete futuro (arredondado ao minuto). */
    #[Test]
    public function dono_edita_nome_e_lembrete(): void
    {
        $at = Carbon::now()->addDay()->setSecond(42);

        $response = $this->send($this->request('PATCH', '/api/canela-bookmarks/1', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-bookmarks', 'id' => '1', 'attributes' => ['name' => 'Renomeado', 'reminderAt' => $at->toIso8601String()]]],
        ]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $bookmark = Bookmark::query()->find(1);

        $this->assertEquals('Renomeado', $bookmark->name);
        $this->assertEquals($at->copy()->utc()->startOfMinute()->toDateTimeString(), $bookmark->reminder_at->toDateTimeString());
    }

    /** O marcador de outra pessoa é invisível: 404, nem ver, nem editar, nem apagar. */
    #[Test]
    public function marcador_alheio_responde_404(): void
    {
        $show = $this->send($this->request('GET', '/api/canela-bookmarks/2', ['authenticatedAs' => 2]));
        $patch = $this->send($this->request('PATCH', '/api/canela-bookmarks/2', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-bookmarks', 'id' => '2', 'attributes' => ['name' => 'Roubado']]],
        ]));
        $delete = $this->send($this->request('DELETE', '/api/canela-bookmarks/2', ['authenticatedAs' => 2]));

        $this->assertEquals(404, $show->getStatusCode());
        $this->assertEquals(404, $patch->getStatusCode());
        $this->assertEquals(404, $delete->getStatusCode());
        $this->assertEquals('Do outro', Bookmark::query()->find(2)->name);
    }

    /** Nem o admin lê os marcadores dos outros. */
    #[Test]
    public function admin_nao_ve_marcador_alheio(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-bookmarks/1', ['authenticatedAs' => 1]));

        $this->assertEquals(404, $response->getStatusCode());
    }

    /** O dono desmarca: o marcador some do banco. */
    #[Test]
    public function dono_apaga_o_marcador(): void
    {
        $response = $this->send($this->request('DELETE', '/api/canela-bookmarks/1', ['authenticatedAs' => 2]));

        $this->assertEquals(204, $response->getStatusCode());
        $this->assertNull(Bookmark::query()->find(1));
    }

    /** Um post que o ator não vê (oculto) não pode ser marcado. */
    #[Test]
    public function nao_marca_post_que_nao_ve(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-bookmarks', [
            'authenticatedAs' => 2,
            'json' => ['data' => [
                'type' => 'canela-bookmarks',
                'relationships' => ['post' => ['data' => ['type' => 'posts', 'id' => '3']]],
            ]],
        ]));

        $this->assertEquals(404, $response->getStatusCode());
        $this->assertNull(Bookmark::query()->where('user_id', 2)->where('post_id', 3)->first());
    }

    /** Com o recurso desligado no admin, a API responde 404. */
    #[Test]
    public function recurso_desligado_responde_404(): void
    {
        $this->setting('canela.bookmarks_enabled', '0');

        $index = $this->send($this->request('GET', '/api/canela-bookmarks', ['authenticatedAs' => 2]));
        $create = $this->send($this->request('POST', '/api/canela-bookmarks', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'canela-bookmarks', 'relationships' => ['post' => ['data' => ['type' => 'posts', 'id' => '2']]]]],
        ]));

        $this->assertEquals(404, $index->getStatusCode());
        $this->assertEquals(404, $create->getStatusCode());
        $this->assertNull(Bookmark::query()->where('user_id', 2)->where('post_id', 2)->first());
    }

    /** O post traz o marcador do ator (`bookmarked`, `bookmarkId`, `bookmarkName`). */
    #[Test]
    public function post_expoe_o_marcador_do_ator(): void
    {
        $response = $this->send($this->request('GET', '/api/posts/1', ['authenticatedAs' => 2]));

        $this->assertEquals(200, $response->getStatusCode());

        $attributes = $this->body($response)['data']['attributes'];

        $this->assertTrue($attributes['bookmarked']);
        $this->assertEquals(1, $attributes['bookmarkId']);
        $this->assertEquals('Meu marcador', $attributes['bookmarkName']);

        $other = $this->body($this->send($this->request('GET', '/api/posts/2', ['authenticatedAs' => 2])))['data']['attributes'];

        $this->assertFalse($other['bookmarked']);
        $this->assertNull($other['bookmarkId']);
    }

    /** Para visitantes os campos do marcador nem aparecem no post. */
    #[Test]
    public function campos_do_post_somem_para_visitante(): void
    {
        $guest = $this->body($this->send($this->request('GET', '/api/posts/1')))['data']['attributes'];

        $this->assertArrayNotHasKey('bookmarked', $guest);
    }

    /** Com o recurso desligado, os campos do marcador somem do post. */
    #[Test]
    public function campos_do_post_somem_com_recurso_desligado(): void
    {
        $this->setting('canela.bookmarks_enabled', '0');

        $off = $this->body($this->send($this->request('GET', '/api/posts/1', ['authenticatedAs' => 2])))['data']['attributes'];

        $this->assertArrayNotHasKey('bookmarked', $off);
    }

    /** As opções do recurso chegam ao fórum. */
    #[Test]
    public function opcoes_chegam_ao_forum(): void
    {
        $this->setting('canela.bookmarks_user_menu', '0');

        $attributes = $this->body($this->send($this->request('GET', '/api')))['data']['attributes'];

        $this->assertTrue($attributes['canelaBookmarksEnabled']);
        $this->assertTrue($attributes['canelaBookmarksTopicButton']);
        $this->assertFalse($attributes['canelaBookmarksUserMenu']);
    }
}
