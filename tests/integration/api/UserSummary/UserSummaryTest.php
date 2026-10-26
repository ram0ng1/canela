<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\UserSummary;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Tags\Tag;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * O Resumo do perfil (/api/canela-user-summary/{id}): com quem a pessoa
 * mais conversa e onde. Tudo conta só o que quem pergunta pode ver — tópicos
 * ocultos e etiquetas restritas ficam de fora —, curtir a si mesmo não conta
 * e uma extensão desligada deixa a lista dela nula.
 */
class UserSummaryTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $now = Carbon::now()->subDay();

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'ana', 'email' => 'ana@machine.local', 'is_email_confirmed' => 1],
                ['id' => 4, 'username' => 'bruno', 'email' => 'bruno@machine.local', 'is_email_confirmed' => 1],
                ['id' => 5, 'username' => 'carla', 'email' => 'carla@machine.local', 'is_email_confirmed' => 1],
            ],
            Tag::class => [
                ['id' => 1, 'name' => 'Geral', 'slug' => 'geral', 'position' => 0, 'parent_id' => null],
                ['id' => 2, 'name' => 'Restrita', 'slug' => 'restrita', 'position' => 1, 'parent_id' => null, 'is_restricted' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Da Ana', 'created_at' => $now, 'last_posted_at' => $now, 'user_id' => 3, 'first_post_id' => 1, 'comment_count' => 3],
                ['id' => 2, 'title' => 'Da normal', 'created_at' => $now, 'last_posted_at' => $now, 'user_id' => 2, 'first_post_id' => 4, 'comment_count' => 1],
                ['id' => 3, 'title' => 'Oculto', 'created_at' => $now, 'last_posted_at' => $now, 'user_id' => 2, 'first_post_id' => 5, 'comment_count' => 1, 'hidden_at' => $now],
                ['id' => 4, 'title' => 'Restrito', 'created_at' => $now, 'last_posted_at' => $now, 'user_id' => 2, 'first_post_id' => 6, 'comment_count' => 1],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'created_at' => $now, 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>a</p></t>', 'number' => 1],
                ['id' => 2, 'discussion_id' => 1, 'created_at' => $now, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>b</p></t>', 'number' => 2],
                ['id' => 3, 'discussion_id' => 1, 'created_at' => $now, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>c</p></t>', 'number' => 3],
                ['id' => 4, 'discussion_id' => 2, 'created_at' => $now, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>d</p></t>', 'number' => 1],
                ['id' => 5, 'discussion_id' => 3, 'created_at' => $now, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>e</p></t>', 'number' => 1],
                ['id' => 6, 'discussion_id' => 4, 'created_at' => $now, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>f</p></t>', 'number' => 1],
            ],
            'discussion_tag' => [
                ['discussion_id' => 1, 'tag_id' => 1],
                ['discussion_id' => 2, 'tag_id' => 1],
                ['discussion_id' => 3, 'tag_id' => 1],
                ['discussion_id' => 4, 'tag_id' => 2],
            ],
            'post_likes' => [
                ['post_id' => 2, 'user_id' => 3],
                ['post_id' => 3, 'user_id' => 3],
                ['post_id' => 2, 'user_id' => 4],
                // Curtiu a si mesma: não conta.
                ['post_id' => 4, 'user_id' => 2],
                // Num tópico oculto e numa etiqueta restrita.
                ['post_id' => 5, 'user_id' => 5],
                ['post_id' => 6, 'user_id' => 5],
                // A normal curtiu a Ana.
                ['post_id' => 1, 'user_id' => 2],
            ],
            'post_mentions_post' => [
                ['post_id' => 2, 'mentions_post_id' => 1],
            ],
        ]);
    }

    private function summary(int $userId, ?int $actor): ResponseInterface
    {
        return $this->send($this->request('GET', "/api/canela-user-summary/$userId", $actor ? ['authenticatedAs' => $actor] : []));
    }

    private function body(ResponseInterface $response): array
    {
        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return json_decode((string) $response->getBody(), true);
    }

    /** @return array<string, int> nome => contagem */
    private static function counts(array $people): array
    {
        return array_column($people, 'count', 'username');
    }

    private function enableAll(): void
    {
        $this->extension('flarum-tags', 'flarum-likes', 'flarum-mentions', 'ramon-canela');
    }

    /**
     * Quem mais curtiu a pessoa, do maior para o menor; curtir a si mesmo não
     * conta, nem curtidas em postagens que o ator não vê.
     */
    #[Test]
    public function mais_curtido_por(): void
    {
        $this->enableAll();

        $body = $this->body($this->summary(2, 3));

        $this->assertSame(['ana' => 2, 'bruno' => 1], self::counts($body['mostLikedBy']));
    }

    /**
     * De quem a pessoa mais curtiu e a quem mais respondeu (citações do
     * flarum/mentions).
     */
    #[Test]
    public function mais_curtiu_e_mais_respondeu(): void
    {
        $this->enableAll();

        $body = $this->body($this->summary(2, 3));

        $this->assertSame(['ana' => 1], self::counts($body['mostLiked']));
        $this->assertSame(['ana' => 1], self::counts($body['mostRepliedTo']));
        $this->assertSame('3', $body['mostLiked'][0]['id']);
    }

    /**
     * As categorias contam tópicos e respostas visíveis; a etiqueta
     * restrita e o tópico oculto não aparecem para um membro.
     */
    #[Test]
    public function melhores_categorias_respeitam_visibilidade(): void
    {
        $this->enableAll();

        $categories = $this->body($this->summary(2, 3))['topCategories'];

        $this->assertCount(1, $categories);
        $this->assertSame('geral', $categories[0]['slug']);
        $this->assertSame(1, $categories[0]['topics']);
        $this->assertSame(2, $categories[0]['replies']);
    }

    /**
     * O admin vê o oculto e o restrito: as contas dele são maiores. A
     * resposta em cache é por quem pergunta, então um não recebe a do outro.
     */
    #[Test]
    public function admin_ve_o_que_o_membro_nao_ve(): void
    {
        $this->enableAll();

        $member = $this->body($this->summary(2, 3));
        $admin = $this->body($this->summary(2, 1));

        $this->assertArrayNotHasKey('carla', self::counts($member['mostLikedBy']));
        $this->assertSame(2, self::counts($admin['mostLikedBy'])['carla']);
        $this->assertSame(['geral', 'restrita'], array_column($admin['topCategories'], 'slug'));
    }

    /**
     * Visitante, num fórum aberto, vê o resumo público.
     */
    #[Test]
    public function visitante_ve_o_resumo_publico(): void
    {
        $this->enableAll();

        $body = $this->body($this->summary(2, null));

        $this->assertSame(['ana' => 2, 'bruno' => 1], self::counts($body['mostLikedBy']));
    }

    /**
     * Fórum fechado a visitantes: o resumo responde como se a pessoa não
     * existisse (404), sem vazar nada.
     */
    #[Test]
    public function forum_fechado_responde_404_ao_visitante(): void
    {
        $this->enableAll();

        $this->database()->table('group_permission')->where('permission', 'viewForum')->where('group_id', 2)->delete();

        $response = $this->summary(2, null);

        $this->assertEquals(404, $response->getStatusCode());
        $this->assertStringNotContainsString('ana', (string) $response->getBody());
    }

    /**
     * Usuário inexistente: 404.
     */
    #[Test]
    public function usuario_inexistente_responde_404(): void
    {
        $this->enableAll();

        $this->assertEquals(404, $this->summary(999, 1)->getStatusCode());
    }

    /**
     * Sem curtidas, menções nem etiquetas, as listas delas são nulas (não
     * vazias): o fórum esconde a seção em vez de mostrá-la sem nada.
     */
    #[Test]
    public function listas_nulas_sem_as_extensoes(): void
    {
        $this->extension('ramon-canela');

        $body = $this->body($this->summary(2, 3));

        $this->assertNull($body['mostLikedBy']);
        $this->assertNull($body['mostLiked']);
        $this->assertNull($body['mostRepliedTo']);
        $this->assertNull($body['topCategories']);

        // Os links são do próprio tema (ligados por padrão): lista vazia, não nula.
        $this->assertSame([], $body['topLinks']);
    }

    /**
     * Com o recurso de links desligado (canela.stats_links_enabled), a lista
     * de links mais clicados é nula.
     */
    #[Test]
    public function links_desligados_deixam_a_lista_nula(): void
    {
        $this->setting('canela.stats_links_enabled', false);
        $this->enableAll();

        $this->assertNull($this->body($this->summary(2, 3))['topLinks']);
    }

    /**
     * Uma pessoa sem atividade recebe listas vazias.
     */
    #[Test]
    public function pessoa_sem_atividade_tem_listas_vazias(): void
    {
        $this->enableAll();

        $body = $this->body($this->summary(4, 3));

        $this->assertSame([], $body['mostLikedBy']);
        $this->assertSame([], $body['mostRepliedTo']);
        $this->assertSame([], $body['topCategories']);
        $this->assertSame(['normal' => 1], self::counts($body['mostLiked']));
    }
}
