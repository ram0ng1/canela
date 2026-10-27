<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Activity;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * A subaba "Reações" do perfil (`GET /api/users/{id}/canela-reactions`): as
 * curtidas da pessoa, da mais nova para a mais antiga, só em postagens que
 * quem pede vê, paginadas por `page[offset]`/`page[limit]`.
 *
 * A pessoa 2 curtiu as postagens 1 (há 3 dias), 2 (há 2) e 3 (ontem, num
 * tópico oculto).
 */
class ReactionsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-likes', 'ramon-canela');

        $now = Carbon::now();

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outra', 'email' => 'outra@machine.local', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Público', 'user_id' => 3, 'created_at' => $now, 'comment_count' => 2, 'first_post_id' => 1, 'last_post_number' => 2],
                ['id' => 2, 'title' => 'Oculto', 'user_id' => 3, 'created_at' => $now, 'comment_count' => 1, 'first_post_id' => 3, 'last_post_number' => 1, 'hidden_at' => $now, 'hidden_user_id' => 1],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t>a</t>', 'number' => 1, 'created_at' => $now],
                ['id' => 2, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t>b</t>', 'number' => 2, 'created_at' => $now],
                ['id' => 3, 'discussion_id' => 2, 'user_id' => 3, 'type' => 'comment', 'content' => '<t>c</t>', 'number' => 1, 'created_at' => $now],
            ],
            'post_likes' => [
                ['post_id' => 1, 'user_id' => 2, 'created_at' => $now->copy()->subDays(3)],
                ['post_id' => 2, 'user_id' => 2, 'created_at' => $now->copy()->subDays(2)],
                ['post_id' => 3, 'user_id' => 2, 'created_at' => $now->copy()->subDay()],
            ],
        ]);
    }

    private function reactions(int $userId, ?int $as = null, array $page = []): array
    {
        $response = $this->send($this->request('GET', "/api/users/$userId/canela-reactions", $as ? ['authenticatedAs' => $as] : [])
            ->withQueryParams($page ? ['page' => $page] : []));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return json_decode((string) $response->getBody(), true);
    }

    /** As curtidas da mais nova para a mais antiga, sem a do tópico que quem pede não vê. */
    #[Test]
    public function curtidas_visiveis_da_mais_nova_para_a_mais_antiga(): void
    {
        $body = $this->reactions(2);

        $this->assertSame([2, 1], array_column($body['data'], 'postId'));
        $this->assertSame([null, null], array_column($body['data'], 'reactionId'));
        $this->assertFalse($body['hasMore']);

        // Quem vê o tópico oculto (a moderação) vê a curtida dele também.
        $this->assertSame([3, 2, 1], array_column($this->reactions(2, 1)['data'], 'postId'));
    }

    /** `page[limit]` e `page[offset]`, com o `hasMore` da próxima página. */
    #[Test]
    public function pagina_por_offset_e_limit(): void
    {
        $first = $this->reactions(2, 1, ['limit' => 2]);

        $this->assertSame([3, 2], array_column($first['data'], 'postId'));
        $this->assertTrue($first['hasMore']);

        $second = $this->reactions(2, 1, ['offset' => 2, 'limit' => 2]);

        $this->assertSame([1], array_column($second['data'], 'postId'));
        $this->assertFalse($second['hasMore']);
    }

    /** Pessoa sem curtidas: lista vazia. Pessoa que não existe: 404. */
    #[Test]
    public function sem_curtidas_ou_inexistente(): void
    {
        $this->assertSame(['data' => [], 'hasMore' => false], $this->reactions(3));
        $this->assertEquals(404, $this->send($this->request('GET', '/api/users/999/canela-reactions'))->getStatusCode());
    }
}
