<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\MeToo;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * "Eu também" (`POST /api/discussions/{id}/canela-me-too` e `canelaMeToo` no tópico): quem não
 * é o autor marca que tem o mesmo problema, em tópicos públicos e abertos.
 */
class MeTooTest extends TestCase
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
                ['id' => 4, 'username' => 'naoconfirmado', 'email' => 'nc@machine.local', 'is_email_confirmed' => 0],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Não funciona', 'user_id' => 2, 'first_post_id' => 1, 'comment_count' => 1, 'last_post_number' => 1],
                ['id' => 2, 'title' => 'Oculto', 'user_id' => 2, 'first_post_id' => 2, 'comment_count' => 1, 'last_post_number' => 1, 'hidden_at' => Carbon::now(), 'hidden_user_id' => 1],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Socorro</p></t>', 'number' => 1],
                ['id' => 2, 'discussion_id' => 2, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Oculto</p></t>', 'number' => 1],
            ],
            'canela_me_too' => [
                ['discussion_id' => 1, 'user_id' => 1, 'created_at' => Carbon::now()],
            ],
        ]);
    }

    private function body($response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    private function toggle(int $actor, int $discussionId = 1)
    {
        return $this->send($this->request('POST', "/api/discussions/$discussionId/canela-me-too", [
            'authenticatedAs' => $actor,
        ]));
    }

    private function meToo(?int $actor, int $discussionId = 1): mixed
    {
        $response = $this->send($this->request('GET', '/api/discussions/'.$discussionId, $actor ? ['authenticatedAs' => $actor] : []));

        $attributes = $this->body($response)['data']['attributes'];

        return array_key_exists('canelaMeToo', $attributes) ? $attributes['canelaMeToo'] : 'ausente';
    }

    /** Na página do tópico vem a contagem, se o ator marcou e se pode marcar. */
    #[Test]
    public function topico_traz_o_estado(): void
    {
        $this->assertEquals(['count' => 1, 'mine' => false, 'can' => true], $this->meToo(3));
    }

    /** Visitante vê a contagem, mas não pode marcar. */
    #[Test]
    public function visitante_e_autor_nao_podem_marcar(): void
    {
        $this->assertEquals(['count' => 1, 'mine' => false, 'can' => false], $this->meToo(null));
    }

    /** O autor do tópico não marca o próprio problema. */
    #[Test]
    public function autor_ve_can_falso(): void
    {
        $this->assertFalse($this->meToo(2)['can']);
    }

    /** Na lista de tópicos o campo não vem: seria uma consulta por linha. */
    #[Test]
    public function lista_de_topicos_nao_traz_o_campo(): void
    {
        $response = $this->send($this->request('GET', '/api/discussions', ['authenticatedAs' => 3]));

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertArrayNotHasKey('canelaMeToo', $this->body($response)['data'][0]['attributes']);
    }

    /** Marcar e desmarcar alterna a contagem e o "eu marquei". */
    #[Test]
    public function marcar_e_desmarcar(): void
    {
        $on = $this->toggle(3);

        $this->assertEquals(200, $on->getStatusCode(), (string) $on->getBody());
        $this->assertEquals(['count' => 2, 'mine' => true, 'subscription' => null, 'can' => true], $this->body($on));

        $off = $this->toggle(3);

        $this->assertEquals(['count' => 1, 'mine' => false, 'subscription' => null, 'can' => true], $this->body($off));
        $this->assertFalse($this->database()->table('canela_me_too')->where('user_id', 3)->exists());
    }

    /** Ao marcar, quem não segue o tópico passa a segui-lo (flarum/subscriptions). */
    #[Test]
    public function marcar_passa_a_seguir_o_topico(): void
    {
        $this->extension('flarum-subscriptions', 'ramon-canela');

        $response = $this->toggle(3);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertEquals('follow', $this->body($response)['subscription']);
        $this->assertEquals('follow', $this->database()->table('discussion_user')->where('user_id', 3)->where('discussion_id', 1)->value('subscription'));
    }

    /** Visitante não marca: nada é gravado (sem sessão, o CSRF barra antes do 401). */
    #[Test]
    public function visitante_nao_marca(): void
    {
        $response = $this->send($this->request('POST', '/api/discussions/1/canela-me-too'));

        $this->assertContains($response->getStatusCode(), [400, 401]);
        $this->assertEquals(1, $this->database()->table('canela_me_too')->count());
    }

    /** O autor recebe 403. */
    #[Test]
    public function autor_nao_marca(): void
    {
        $this->assertEquals(403, $this->toggle(2)->getStatusCode());
    }

    /** E-mail não confirmado: 403. */
    #[Test]
    public function email_nao_confirmado_nao_marca(): void
    {
        $this->assertEquals(403, $this->toggle(4)->getStatusCode());
    }

    /** Tópico inexistente ou que a pessoa não vê: 404. */
    #[Test]
    public function topico_invisivel_responde_404(): void
    {
        $this->assertEquals(404, $this->toggle(3, 999)->getStatusCode());
        $this->assertEquals(404, $this->toggle(3, 2)->getStatusCode());
    }

    /** Tópico oculto (visto pelo admin) não mostra o botão nem aceita marcação. */
    #[Test]
    public function topico_oculto_nao_tem_botao(): void
    {
        $this->assertNull($this->meToo(1, 2));
    }

    /** Tópico trancado (flarum/lock): o botão aparece, mas não marca. */
    #[Test]
    public function topico_trancado_nao_marca(): void
    {
        $this->extension('flarum-lock', 'ramon-canela');
        $this->prepareDatabase([
            Discussion::class => [
                ['id' => 1, 'title' => 'Não funciona', 'user_id' => 2, 'first_post_id' => 1, 'comment_count' => 1, 'last_post_number' => 1, 'is_locked' => true],
            ],
        ]);

        $this->assertFalse($this->meToo(3)['can']);
        $this->assertEquals(403, $this->toggle(3)->getStatusCode());
    }

    /** Com tags escolhidas no admin, só vale nos tópicos dessas tags. */
    #[Test]
    public function so_nas_tags_escolhidas(): void
    {
        $this->extension('flarum-tags', 'ramon-canela');
        $this->setting('canela.metoo_tags', '10');
        $this->prepareDatabase([
            'tags' => [
                ['id' => 10, 'name' => 'Suporte', 'slug' => 'suporte', 'position' => 0],
                ['id' => 11, 'name' => 'Geral', 'slug' => 'geral', 'position' => 1],
            ],
            'discussion_tag' => [
                ['discussion_id' => 1, 'tag_id' => 11],
            ],
        ]);

        $this->assertNull($this->meToo(3));
        $this->assertEquals(403, $this->toggle(3)->getStatusCode());
    }

    /** Uma tag escolhida libera o botão nos tópicos dela. */
    #[Test]
    public function vale_na_tag_escolhida(): void
    {
        $this->extension('flarum-tags', 'ramon-canela');
        $this->setting('canela.metoo_tags', '10');
        $this->prepareDatabase([
            'tags' => [
                ['id' => 10, 'name' => 'Suporte', 'slug' => 'suporte', 'position' => 0],
            ],
            'discussion_tag' => [
                ['discussion_id' => 1, 'tag_id' => 10],
            ],
        ]);

        $this->assertTrue($this->meToo(3)['can']);
        $this->assertEquals(200, $this->toggle(3)->getStatusCode());
    }

    /** Mais de 5 trocas na hora no mesmo tópico: 429. */
    #[Test]
    public function limite_de_trocas_por_hora(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->assertEquals(200, $this->toggle(3)->getStatusCode());
        }

        $this->assertEquals(429, $this->toggle(3)->getStatusCode());
    }

    /** Desligado no admin: a rota responde 404 e o campo some do tópico. */
    #[Test]
    public function recurso_desligado(): void
    {
        $this->setting('canela.metoo_enabled', '0');

        $this->assertEquals(404, $this->toggle(3)->getStatusCode());
        $this->assertEquals('ausente', $this->meToo(3));
        $this->assertFalse($this->body($this->send($this->request('GET', '/api')))['data']['attributes']['canelaMeTooEnabled']);
    }

    /**
     * Quem silenciou o tópico ('ignore') continua silenciado ao marcar: só
     * quem nunca escolheu passa a seguir.
     */
    #[Test]
    public function marcar_nao_desfaz_o_silenciar(): void
    {
        $this->extension('flarum-subscriptions', 'ramon-canela');
        $this->prepareDatabase([
            'discussion_user' => [
                ['discussion_id' => 1, 'user_id' => 3, 'subscription' => 'ignore'],
            ],
        ]);

        $response = $this->toggle(3);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertEquals('ignore', $this->body($response)['subscription']);
        $this->assertEquals('ignore', $this->database()->table('discussion_user')->where('user_id', 3)->where('discussion_id', 1)->value('subscription'));
    }

    /**
     * Sem a permissão de responder no tópico (como as reações pedem a delas),
     * não se marca: `can` falso e 403.
     */
    #[Test]
    public function sem_permissao_de_responder_nao_marca(): void
    {
        $this->app();
        $this->database()->table('group_permission')->where('permission', 'discussion.reply')->delete();

        $this->assertFalse($this->meToo(3)['can']);
        $this->assertEquals(403, $this->toggle(3)->getStatusCode());
        $this->assertFalse($this->database()->table('canela_me_too')->where('user_id', 3)->exists());
    }

    /**
     * O próprio voto sai mesmo quando marcar não vale mais (tópico trancado
     * depois do voto); marcar de novo continua barrado.
     */
    #[Test]
    public function trancado_ainda_tira_o_proprio_voto(): void
    {
        $this->extension('flarum-lock', 'ramon-canela');
        $this->prepareDatabase([
            Discussion::class => [
                ['id' => 1, 'title' => 'Não funciona', 'user_id' => 2, 'first_post_id' => 1, 'comment_count' => 1, 'last_post_number' => 1, 'is_locked' => true],
            ],
            'canela_me_too' => [
                ['discussion_id' => 1, 'user_id' => 3, 'created_at' => Carbon::now()],
            ],
        ]);

        $off = $this->toggle(3);

        $this->assertEquals(200, $off->getStatusCode(), (string) $off->getBody());
        $this->assertEquals(['count' => 1, 'mine' => false, 'subscription' => null, 'can' => false], $this->body($off));
        $this->assertFalse($this->database()->table('canela_me_too')->where('user_id', 3)->exists());

        $this->assertEquals(403, $this->toggle(3)->getStatusCode());
    }

    /**
     * A regra é a MeTooPolicy (`canelaMeToo`), com `forceDeny`: o
     * administrador também não marca o próprio tópico nem um tópico trancado.
     */
    #[Test]
    public function administrador_segue_as_mesmas_regras(): void
    {
        $this->extension('flarum-lock', 'ramon-canela');
        $this->prepareDatabase([
            Discussion::class => [
                ['id' => 3, 'title' => 'Do admin', 'user_id' => 1, 'first_post_id' => 3, 'comment_count' => 1, 'last_post_number' => 1],
                ['id' => 4, 'title' => 'Trancado', 'user_id' => 2, 'first_post_id' => 4, 'comment_count' => 1, 'last_post_number' => 1, 'is_locked' => true],
            ],
            Post::class => [
                ['id' => 3, 'discussion_id' => 3, 'user_id' => 1, 'type' => 'comment', 'content' => '<t><p>Meu</p></t>', 'number' => 1],
                ['id' => 4, 'discussion_id' => 4, 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>Trancado</p></t>', 'number' => 1],
            ],
        ]);

        $this->assertFalse($this->meToo(1, 3)['can']);
        $this->assertEquals(403, $this->toggle(1, 3)->getStatusCode());
        $this->assertFalse($this->meToo(1, 4)['can']);
        $this->assertEquals(403, $this->toggle(1, 4)->getStatusCode());
        $this->assertSame(0, $this->database()->table('canela_me_too')->whereIn('discussion_id', [3, 4])->count());
    }

    /**
     * Numa tag restrita em que a pessoa pode responder, ela também marca: a
     * política das tags não barra a habilidade `canelaMeToo`.
     */
    #[Test]
    public function tag_restrita_com_permissao_de_responder_marca(): void
    {
        $this->extension('flarum-tags', 'ramon-canela');
        $this->prepareDatabase([
            'tags' => [
                ['id' => 10, 'name' => 'Restrita', 'slug' => 'restrita', 'position' => 0, 'is_restricted' => true],
            ],
            'discussion_tag' => [
                ['discussion_id' => 1, 'tag_id' => 10],
            ],
            'group_permission' => [
                ['group_id' => 3, 'permission' => 'tag10.viewForum'],
                ['group_id' => 3, 'permission' => 'tag10.discussion.reply'],
            ],
        ]);

        $this->assertTrue($this->meToo(3)['can']);
        $this->assertEquals(200, $this->toggle(3)->getStatusCode());
    }

    /** Na tag restrita sem a permissão de responder, não. */
    #[Test]
    public function tag_restrita_sem_permissao_de_responder_nao_marca(): void
    {
        $this->extension('flarum-tags', 'ramon-canela');
        $this->prepareDatabase([
            'tags' => [
                ['id' => 10, 'name' => 'Restrita', 'slug' => 'restrita', 'position' => 0, 'is_restricted' => true],
            ],
            'discussion_tag' => [
                ['discussion_id' => 1, 'tag_id' => 10],
            ],
            'group_permission' => [
                ['group_id' => 3, 'permission' => 'tag10.viewForum'],
            ],
        ]);

        $this->assertFalse($this->meToo(3)['can']);
        $this->assertEquals(403, $this->toggle(3)->getStatusCode());
    }
}
