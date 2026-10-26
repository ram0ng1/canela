<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Gaps;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * As notificações "editou sua postagem" (canelaPostEdited) e "vinculou seu
 * tópico" (canelaTopicLinked): quem é avisado, quando não sai aviso e a chave
 * que desliga cada uma.
 */
class NotificationsTest extends TestCase
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
                ['id' => 1, 'title' => 'Tópico da normal', 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'user_id' => 2, 'first_post_id' => 1, 'comment_count' => 1, 'last_post_number' => 1, 'last_post_id' => 1],
                ['id' => 2, 'title' => 'Tópico do outro', 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'user_id' => 3, 'first_post_id' => 2, 'comment_count' => 1, 'last_post_number' => 1, 'last_post_id' => 2],
                ['id' => 3, 'title' => 'Tópico oculto', 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'user_id' => 1, 'first_post_id' => 3, 'comment_count' => 1, 'last_post_number' => 1, 'last_post_id' => 3, 'hidden_at' => Carbon::now(), 'hidden_user_id' => 1],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'created_at' => Carbon::now()->subHour(), 'user_id' => 2, 'type' => 'comment', 'content' => '<t><p>original</p></t>', 'number' => 1],
                ['id' => 2, 'discussion_id' => 2, 'created_at' => Carbon::now()->subHour(), 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>post do outro</p></t>', 'number' => 1],
                ['id' => 3, 'discussion_id' => 3, 'created_at' => Carbon::now()->subHour(), 'user_id' => 1, 'type' => 'comment', 'content' => '<t><p>oculto</p></t>', 'number' => 1],
            ],
        ]);
    }

    private function edit(int $postId, int $actor, string $content): ResponseInterface
    {
        return $this->send($this->request('PATCH', "/api/posts/$postId", [
            'authenticatedAs' => $actor,
            'json' => ['data' => ['type' => 'posts', 'id' => (string) $postId, 'attributes' => ['content' => $content]]],
        ]));
    }

    private function reply(int $discussionId, int $actor, string $content): ResponseInterface
    {
        return $this->send($this->request('POST', '/api/posts', [
            'authenticatedAs' => $actor,
            'json' => ['data' => [
                'type' => 'posts',
                'attributes' => ['content' => $content],
                'relationships' => ['discussion' => ['data' => ['type' => 'discussions', 'id' => (string) $discussionId]]],
            ]],
        ]));
    }

    private function notifications(int $userId, string $type): int
    {
        return $this->database()->table('notifications')->where('user_id', $userId)->where('type', $type)->count();
    }

    /**
     * A moderação edita a postagem de alguém: o autor recebe "editou sua postagem".
     */
    #[Test]
    public function editar_postagem_de_outra_pessoa_avisa_o_autor(): void
    {
        $response = $this->edit(1, 1, 'texto corrigido pela moderação');

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertEquals(1, $this->notifications(2, 'canelaPostEdited'));

        $notification = $this->database()->table('notifications')->where('type', 'canelaPostEdited')->first();
        $this->assertEquals(1, $notification->from_user_id);
        $this->assertEquals(1, $notification->subject_id);
    }

    /**
     * A própria edição não avisa ninguém.
     */
    #[Test]
    public function editar_a_propria_postagem_nao_avisa(): void
    {
        $response = $this->edit(1, 2, 'eu mesma corrigi');

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertEquals(0, $this->database()->table('notifications')->where('type', 'canelaPostEdited')->count());
    }

    /**
     * Com a chave canela.notify_post_edited desligada, a edição não avisa.
     */
    #[Test]
    public function aviso_de_edicao_desligado(): void
    {
        $this->setting('canela.notify_post_edited', false);

        $this->assertEquals(200, $this->edit(1, 1, 'texto corrigido')->getStatusCode());
        $this->assertEquals(0, $this->notifications(2, 'canelaPostEdited'));
    }

    /**
     * Uma resposta com link para o tópico de outra pessoa avisa o autor do
     * tópico, com o id dele nos dados.
     */
    #[Test]
    public function link_para_topico_avisa_o_autor(): void
    {
        $response = $this->reply(2, 3, 'Relacionado: http://localhost/d/1-topico-da-normal');

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());
        $this->assertEquals(1, $this->notifications(2, 'canelaTopicLinked'));

        $data = json_decode((string) $this->database()->table('notifications')->where('type', 'canelaTopicLinked')->value('data'), true);
        $this->assertEquals(1, $data['discussionId']);
    }

    /**
     * Linkar o próprio tópico, ou o tópico em que se está respondendo, não avisa.
     */
    #[Test]
    public function link_para_o_proprio_topico_nao_avisa(): void
    {
        $this->assertEquals(201, $this->reply(2, 2, 'meu tópico: http://localhost/d/1')->getStatusCode());
        $this->assertEquals(201, $this->reply(1, 3, 'este mesmo: http://localhost/d/1')->getStatusCode());

        $this->assertEquals(0, $this->database()->table('notifications')->where('type', 'canelaTopicLinked')->count());
    }

    /**
     * Link editado para dentro de uma postagem existente também avisa.
     */
    #[Test]
    public function link_acrescentado_na_edicao_avisa(): void
    {
        $this->assertEquals(200, $this->edit(2, 3, 'agora com link /d/1')->getStatusCode());

        $this->assertEquals(1, $this->notifications(2, 'canelaTopicLinked'));
    }

    /**
     * Quem não vê a postagem com o link (tópico oculto pela moderação) não é avisado.
     */
    #[Test]
    public function link_em_postagem_invisivel_nao_avisa(): void
    {
        $this->assertEquals(200, $this->edit(3, 1, 'link escondido http://localhost/d/1')->getStatusCode());

        $this->assertEquals(0, $this->notifications(2, 'canelaTopicLinked'));
    }

    /**
     * Com a chave canela.notify_topic_linked desligada, nada de aviso.
     */
    #[Test]
    public function aviso_de_link_desligado(): void
    {
        $this->setting('canela.notify_topic_linked', false);

        $this->assertEquals(201, $this->reply(2, 3, 'http://localhost/d/1')->getStatusCode());
        $this->assertEquals(0, $this->notifications(2, 'canelaTopicLinked'));
    }

    /**
     * As chaves chegam ao fórum, para ele esconder as opções nas preferências.
     */
    #[Test]
    public function chaves_chegam_ao_forum(): void
    {
        $this->setting('canela.notify_topic_linked', false);

        $attributes = json_decode((string) $this->send($this->request('GET', '/api'))->getBody(), true)['data']['attributes'];

        $this->assertTrue($attributes['canelaNotifyPostEdited']);
        $this->assertFalse($attributes['canelaNotifyTopicLinked']);
        $this->assertTrue($attributes['canelaGapsBackend']);
    }
}
