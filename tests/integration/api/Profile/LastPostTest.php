<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Profile;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * "Última postagem" do perfil (`canelaLastPostAt`): vem com o próprio
 * usuário na resposta do perfil, com o último comentário que quem está vendo
 * pode ver — e não vai nas listas de usuários (seria uma consulta por pessoa).
 *
 * normal (2) tem: um comentário visível há 3 dias (post 2), um oculto há 1
 * dia (post 3) e um, há 2 dias, numa discussão oculta (post 5).
 */
class LastPostTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser() + ['comment_count' => 3],
                ['id' => 3, 'username' => 'semposts', 'email' => 'semposts@machine.local', 'is_email_confirmed' => 1, 'comment_count' => 0],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Aberta', 'user_id' => 1, 'created_at' => Carbon::now()->subDays(5), 'comment_count' => 3, 'first_post_id' => 1, 'last_post_number' => 3],
                ['id' => 2, 'title' => 'Oculta', 'user_id' => 1, 'created_at' => Carbon::now()->subDays(5), 'comment_count' => 2, 'first_post_id' => 4, 'last_post_number' => 2, 'hidden_at' => Carbon::now()->subDay(), 'hidden_user_id' => 1],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Oi</t>', 'number' => 1, 'created_at' => Carbon::now()->subDays(5)],
                ['id' => 2, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t>Visível</t>', 'number' => 2, 'created_at' => Carbon::parse('-3 days')->startOfSecond()],
                ['id' => 3, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t>Oculto</t>', 'number' => 3, 'created_at' => Carbon::now()->subDay(), 'hidden_at' => Carbon::now(), 'hidden_user_id' => 1],
                ['id' => 4, 'discussion_id' => 2, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Oi</t>', 'number' => 1, 'created_at' => Carbon::now()->subDays(5)],
                ['id' => 5, 'discussion_id' => 2, 'user_id' => 2, 'type' => 'comment', 'content' => '<t>Na oculta</t>', 'number' => 2, 'created_at' => Carbon::now()->subDays(2)],
            ],
        ]);
    }

    private function show(int $userId, ?int $actor = null): array
    {
        $response = $this->send($this->request('GET', "/api/users/$userId", $actor ? ['authenticatedAs' => $actor] : []));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return json_decode((string) $response->getBody(), true)['data']['attributes'];
    }

    /**
     * Um membro qualquer vê a data do último comentário que ele mesmo pode
     * ver: o oculto e o da discussão oculta ficam de fora.
     */
    #[Test]
    public function perfil_traz_o_ultimo_comentario_visivel(): void
    {
        $attributes = $this->show(2, 3);

        $this->assertArrayHasKey('canelaLastPostAt', $attributes);
        $this->assertSame(Post::find(2)->created_at->getTimestamp(), Carbon::parse($attributes['canelaLastPostAt'])->getTimestamp());
    }

    /**
     * Quem vê o oculto (a administração) vê a data dele, como no pedido de
     * posts que o front fazia antes.
     */
    #[Test]
    public function administracao_ve_o_comentario_oculto(): void
    {
        $attributes = $this->show(2, 1);

        $this->assertSame(Post::find(3)->created_at->getTimestamp(), Carbon::parse($attributes['canelaLastPostAt'])->getTimestamp());
    }

    #[Test]
    public function sem_comentarios_vem_nulo(): void
    {
        $this->assertNull($this->show(3, 2)['canelaLastPostAt']);
    }

    /**
     * Na lista de usuários o campo não vai: seria uma consulta a mais por
     * pessoa da lista.
     */
    #[Test]
    public function lista_de_usuarios_nao_traz_o_campo(): void
    {
        $response = $this->send($this->request('GET', '/api/users', ['authenticatedAs' => 1]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        foreach (json_decode((string) $response->getBody(), true)['data'] as $user) {
            $this->assertArrayNotHasKey('canelaLastPostAt', $user['attributes']);
        }
    }

    /**
     * Com as estatísticas do perfil desligadas no admin, o campo some.
     */
    #[Test]
    public function estatisticas_desligadas_tiram_o_campo(): void
    {
        $this->setting('canela.user_stats', '0');

        $this->assertArrayNotHasKey('canelaLastPostAt', $this->show(2, 3));
    }
}
