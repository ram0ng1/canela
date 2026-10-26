<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Stats;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;

/**
 * O resumo de atividade do perfil: curtidas recebidas e dadas seguem a mesma
 * visibilidade — só postagens públicas de tópicos públicos contam.
 */
class UserActivityTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-likes', 'ramon-canela');

        $now = Carbon::now();
        $post = fn (int $id, int $discussion, int $user, int $number, array $extra = []) => $extra + [
            'id' => $id, 'discussion_id' => $discussion, 'user_id' => $user, 'type' => 'comment',
            'content' => '<t>x</t>', 'number' => $number, 'created_at' => $now,
        ];

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'autora', 'email' => 'autora@machine.local', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Público', 'user_id' => 3, 'created_at' => $now, 'comment_count' => 3, 'first_post_id' => 1, 'last_post_number' => 3],
                ['id' => 2, 'title' => 'Privado', 'user_id' => 3, 'created_at' => $now, 'comment_count' => 1, 'first_post_id' => 4, 'last_post_number' => 1, 'is_private' => 1],
                ['id' => 3, 'title' => 'Oculto', 'user_id' => 3, 'created_at' => $now, 'comment_count' => 1, 'first_post_id' => 5, 'last_post_number' => 1, 'hidden_at' => $now],
            ],
            Post::class => [
                $post(1, 1, 3, 1),
                $post(2, 1, 3, 2, ['hidden_at' => $now]),
                $post(3, 1, 3, 3, ['is_private' => 1]),
                $post(4, 2, 3, 1),
                $post(5, 3, 3, 1),
            ],
            // A pessoa 2 curte tudo da autora: só a curtida da postagem 1 é pública.
            'post_likes' => array_map(fn (int $id) => ['post_id' => $id, 'user_id' => 2, 'created_at' => $now], [1, 2, 3, 4, 5]),
        ]);
    }

    private function attributes(int $user, int $as): array
    {
        $response = $this->send($this->request('GET', "/api/users/$user", ['authenticatedAs' => $as]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return json_decode((string) $response->getBody(), true)['data']['attributes'];
    }

    /**
     * Curtidas recebidas não contam postagens ocultas/privadas nem tópicos
     * privados/ocultos — como as dadas já não contavam.
     */
    #[Test]
    public function curtidas_recebidas_seguem_a_visibilidade_das_dadas(): void
    {
        $this->assertSame(1, $this->attributes(3, 2)['canelaLikesReceived']);
        $this->assertSame(1, $this->attributes(2, 3)['canelaLikesGiven']);
    }
}
