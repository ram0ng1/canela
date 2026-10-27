<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Topic;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * "Marcar não lido" no rodapé do tópico: `canelaMarkUnread` só faz a
 * leitura da própria pessoa voltar (nunca avançar), no máximo até antes do
 * último comentário, e o tópico volta a contar como não lido — mesmo depois
 * de um "marcar tudo como lido".
 *
 * Cenário: o tópico 1 tem 3 comentários; normal (2) leu todos. O 2 é oculto.
 */
class MarkUnreadTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->setting('canela.marked_unread_schema', '1');

        $past = Carbon::now()->subHours(3);

        $this->prepareDatabase([
            User::class => [
                array_merge($this->normalUser(), ['marked_all_as_read_at' => Carbon::now()->subHour()]),
                ['id' => 3, 'username' => 'outra', 'email' => 'outra@machine.local', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Lido', 'user_id' => 3, 'created_at' => $past, 'last_posted_at' => $past, 'comment_count' => 3, 'first_post_id' => 11, 'last_post_number' => 3],
                ['id' => 2, 'title' => 'Oculto', 'user_id' => 3, 'created_at' => $past, 'last_posted_at' => $past, 'comment_count' => 1, 'first_post_id' => 21, 'last_post_number' => 1, 'hidden_at' => $past],
            ],
            Post::class => [
                ['id' => 11, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t>1</t>', 'number' => 1, 'created_at' => $past],
                ['id' => 12, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t>2</t>', 'number' => 2, 'created_at' => $past],
                ['id' => 13, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t>3</t>', 'number' => 3, 'created_at' => $past],
                ['id' => 21, 'discussion_id' => 2, 'user_id' => 3, 'type' => 'comment', 'content' => '<t>x</t>', 'number' => 1, 'created_at' => $past],
            ],
            'discussion_user' => [
                ['discussion_id' => 1, 'user_id' => 2, 'last_read_post_number' => 3, 'last_read_at' => $past],
            ],
        ]);
    }

    private function markUnread(int $discussionId, int $number, ?int $as = 2): ResponseInterface
    {
        return $this->send($this->request('PATCH', "/api/discussions/$discussionId", ($as ? ['authenticatedAs' => $as] : []) + [
            'json' => ['data' => ['type' => 'discussions', 'id' => (string) $discussionId, 'attributes' => ['canelaMarkUnread' => $number]]],
        ]));
    }

    private function state(int $discussionId, int $userId): ?object
    {
        return $this->database()->table('discussion_user')->where('discussion_id', $discussionId)->where('user_id', $userId)->first();
    }

    /**
     * Voltar a leitura: grava o número e quando foi marcado, e a API devolve
     * `canelaMarkedUnreadAt`.
     */
    #[Test]
    public function marca_o_topico_como_nao_lido(): void
    {
        $response = $this->markUnread(1, 1);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $state = $this->state(1, 2);
        $this->assertSame(1, (int) $state->last_read_post_number);
        $this->assertNotNull($state->canela_marked_unread_at);

        $attributes = json_decode((string) $response->getBody(), true)['data']['attributes'];
        $this->assertNotNull($attributes['canelaMarkedUnreadAt']);
        $this->assertArrayNotHasKey('canelaMarkUnread', $attributes);
    }

    /**
     * Nunca avança a leitura (isso é do core).
     */
    #[Test]
    public function nao_avanca_a_leitura(): void
    {
        $this->database()->table('discussion_user')->where('discussion_id', 1)->where('user_id', 2)->update(['last_read_post_number' => 1]);

        $this->markUnread(1, 3);

        $state = $this->state(1, 2);
        $this->assertSame(1, (int) $state->last_read_post_number);
        $this->assertNull($state->canela_marked_unread_at);
    }

    /**
     * Um número além do fim vira "antes do último comentário".
     */
    #[Test]
    public function numero_alem_do_fim_fica_antes_do_ultimo(): void
    {
        $this->markUnread(1, 99);

        $this->assertSame(2, (int) $this->state(1, 2)->last_read_post_number);
    }

    /**
     * Só a leitura de quem pediu muda; quem nunca abriu o tópico não ganha
     * uma leitura nova.
     */
    #[Test]
    public function so_muda_a_leitura_de_quem_pediu(): void
    {
        $this->database()->table('discussion_user')->insert(['discussion_id' => 1, 'user_id' => 3, 'last_read_post_number' => 3, 'last_read_at' => Carbon::now()]);

        $this->markUnread(1, 1, 2);
        $this->assertSame(3, (int) $this->state(1, 3)->last_read_post_number);

        $this->database()->table('discussion_user')->where('user_id', 3)->delete();
        $this->markUnread(1, 0, 3);
        $this->assertNull($this->state(1, 3));
    }

    /**
     * Visitante não marca nada; tópico que a pessoa não vê responde 404.
     */
    #[Test]
    public function visitante_e_topico_invisivel_nao_marcam(): void
    {
        $this->assertContains($this->markUnread(1, 1, null)->getStatusCode(), [400, 401, 403]);
        $this->assertSame(3, (int) $this->state(1, 2)->last_read_post_number);

        $this->assertEquals(404, $this->markUnread(2, 0)->getStatusCode());
        $this->assertNull($this->state(2, 2));
    }

    /**
     * Depois de "marcar tudo como lido", o tópico marcado como não lido volta
     * a contar em "Não lidos (N)" e na aba "Não lidos".
     */
    #[Test]
    public function volta_a_contar_como_nao_lido_depois_de_marcar_tudo(): void
    {
        $before = json_decode((string) $this->send($this->request('GET', '/api/forums/canela-counts', ['authenticatedAs' => 2]))->getBody(), true);
        $this->assertSame(0, $before['unread']);

        $this->markUnread(1, 1);

        $after = json_decode((string) $this->send($this->request('GET', '/api/forums/canela-counts', ['authenticatedAs' => 2]))->getBody(), true);
        $this->assertSame(1, $after['unread']);

        $list = $this->send($this->request('GET', '/api/discussions', ['authenticatedAs' => 2])->withQueryParams(['filter' => ['canelaUnread' => '1']]));
        $this->assertSame(['1'], array_column(json_decode((string) $list->getBody(), true)['data'], 'id'));
    }

    /**
     * O fórum anuncia o recurso para o JS mostrar o botão.
     */
    #[Test]
    public function forum_anuncia_o_recurso(): void
    {
        $attributes = json_decode((string) $this->send($this->request('GET', '/api'))->getBody(), true)['data']['attributes'];

        $this->assertTrue($attributes['canelaMarkUnread']);
    }
}
