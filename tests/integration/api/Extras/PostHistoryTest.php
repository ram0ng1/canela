<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Extras;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * Histórico de edições: cada edição guarda a versão anterior, e
 * `GET /api/canela/posts/{id}/revisions` lista as versões para quem pode
 * vê-las — todos que veem o post (público, o padrão) ou só o autor e quem
 * pode editá-lo. Desligado, nada é gravado e a rota não existe.
 *
 * Cenário: a postagem 1 é de normal (2) num tópico público; a 2 está num
 * tópico oculto. outra (3) é uma terceira pessoa.
 */
class PostHistoryTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $past = Carbon::now()->subHour();

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outra', 'email' => 'outra@machine.local', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Público', 'user_id' => 2, 'created_at' => $past, 'last_posted_at' => $past, 'comment_count' => 1, 'first_post_id' => 1, 'last_post_number' => 1],
                ['id' => 2, 'title' => 'Oculto', 'user_id' => 1, 'created_at' => $past, 'last_posted_at' => $past, 'comment_count' => 1, 'first_post_id' => 2, 'last_post_number' => 1, 'hidden_at' => $past],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t>Versão original</t>', 'number' => 1, 'created_at' => $past],
                ['id' => 2, 'discussion_id' => 2, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Segredo</t>', 'number' => 1, 'created_at' => $past],
            ],
            'canela_post_revisions' => [
                ['post_id' => 2, 'user_id' => 1, 'revision' => 1, 'content' => '<t>Segredo antigo</t>', 'created_at' => $past],
            ],
        ]);
    }

    private function edit(int $postId, string $content, int $as = 2): ResponseInterface
    {
        return $this->send($this->request('PATCH', "/api/posts/$postId", [
            'authenticatedAs' => $as,
            'json' => ['data' => ['type' => 'posts', 'id' => (string) $postId, 'attributes' => ['content' => $content]]],
        ]));
    }

    private function revisions(int $postId, ?int $as = null): ResponseInterface
    {
        return $this->send($this->request('GET', "/api/canela/posts/$postId/revisions", $as ? ['authenticatedAs' => $as] : []));
    }

    /**
     * Editar guarda a versão anterior; o histórico lista a original e a atual,
     * com quem escreveu cada uma.
     */
    #[Test]
    public function edicao_guarda_a_versao_anterior(): void
    {
        $this->assertEquals(200, $this->edit(1, 'Versão nova')->getStatusCode());

        $revision = $this->database()->table('canela_post_revisions')->where('post_id', 1)->first();
        $this->assertSame(1, (int) $revision->revision);
        $this->assertSame(2, (int) $revision->user_id);
        $this->assertStringContainsString('Versão original', $revision->content);

        $response = $this->revisions(1, 3);
        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $data = json_decode((string) $response->getBody(), true)['data'];
        $this->assertSame(1, $data['revisionCount']);
        $this->assertFalse($data['contentHidden']);
        $this->assertCount(2, $data['versions']);
        $this->assertStringContainsString('Versão original', $data['versions'][0]['content']);
        $this->assertStringContainsString('Versão nova', $data['versions'][1]['content']);
        $this->assertSame('2', $data['versions'][1]['user']['id']);
    }

    /**
     * Edições seguidas numeram as versões em ordem.
     */
    #[Test]
    public function edicoes_seguidas_numeram_em_ordem(): void
    {
        $this->assertEquals(200, $this->edit(1, 'Segunda')->getStatusCode());

        // Fora da janela do limitador de edições do core.
        $this->database()->table('posts')->where('id', 1)->update(['edited_at' => Carbon::now()->subMinute()]);

        $this->assertEquals(200, $this->edit(1, 'Terceira')->getStatusCode());

        $this->assertSame([1, 2], $this->database()->table('canela_post_revisions')->where('post_id', 1)->orderBy('revision')->pluck('revision')->map(fn ($r) => (int) $r)->all());

        $versions = json_decode((string) $this->revisions(1, 2)->getBody(), true)['data']['versions'];
        $this->assertSame([1, 2, 3], array_column($versions, 'number'));
    }

    /**
     * Público (o padrão): até o visitante vê o histórico de um post visível.
     */
    #[Test]
    public function historico_publico_abre_para_visitante(): void
    {
        $this->edit(1, 'Versão nova');

        $this->assertEquals(200, $this->revisions(1)->getStatusCode());
    }

    /**
     * Restrito: só o autor e quem pode editar o post (o admin).
     */
    #[Test]
    public function historico_restrito_so_para_autor_e_equipe(): void
    {
        $this->setting('canela.post_history_public', false);

        $this->edit(1, 'Versão nova');

        $this->assertEquals(404, $this->revisions(1)->getStatusCode());
        $this->assertEquals(404, $this->revisions(1, 3)->getStatusCode());
        $this->assertEquals(200, $this->revisions(1, 2)->getStatusCode());
        $this->assertEquals(200, $this->revisions(1, 1)->getStatusCode());
    }

    /**
     * Post que a pessoa não vê (tópico oculto): o histórico não vaza.
     */
    #[Test]
    public function post_invisivel_nao_vaza_o_historico(): void
    {
        $response = $this->revisions(2, 3);

        $this->assertEquals(404, $response->getStatusCode());
        $this->assertStringNotContainsString('Segredo', (string) $response->getBody());

        $this->assertEquals(200, $this->revisions(2, 1)->getStatusCode());
    }

    /**
     * O número de versões chega no post para quem pode ver o histórico.
     */
    #[Test]
    public function contagem_de_versoes_no_post(): void
    {
        $this->edit(1, 'Versão nova');

        $attributes = json_decode((string) $this->send($this->request('GET', '/api/posts/1', ['authenticatedAs' => 3]))->getBody(), true)['data']['attributes'];
        $this->assertSame(1, $attributes['canelaRevisionCount']);
    }

    /**
     * Desligado: a edição não grava versão, a rota responde 404 e a contagem
     * some do post.
     */
    #[Test]
    public function desligado_nao_grava_nem_mostra(): void
    {
        $this->setting('canela.post_history_enabled', false);

        $this->assertEquals(200, $this->edit(1, 'Versão nova')->getStatusCode());
        $this->assertSame(0, $this->database()->table('canela_post_revisions')->where('post_id', 1)->count());
        $this->assertEquals(404, $this->revisions(1, 2)->getStatusCode());

        $attributes = json_decode((string) $this->send($this->request('GET', '/api/posts/1', ['authenticatedAs' => 2]))->getBody(), true)['data']['attributes'];
        $this->assertArrayNotHasKey('canelaRevisionCount', $attributes);
    }
}
