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
 * Mapa do tópico: participantes e curtidas contam só os comentários que todo
 * leitor vê (nem ocultos nem privados), e só vêm na página do tópico.
 */
class TopicMapTest extends TestCase
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
                ['id' => 3, 'username' => 'tres', 'email' => 'tres@machine.local', 'is_email_confirmed' => 1],
                ['id' => 4, 'username' => 'quatro', 'email' => 'quatro@machine.local', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Mapa', 'user_id' => 1, 'created_at' => $now, 'last_posted_at' => $now, 'comment_count' => 3, 'first_post_id' => 1, 'last_post_number' => 4],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>a</t>', 'number' => 1, 'created_at' => $now],
                ['id' => 2, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t>b</t>', 'number' => 2, 'created_at' => $now],
                ['id' => 3, 'discussion_id' => 1, 'user_id' => 2, 'type' => 'comment', 'content' => '<t>c</t>', 'number' => 3, 'created_at' => $now],
                // Oculto e privado: nem a pessoa nem a curtida contam.
                ['id' => 4, 'discussion_id' => 1, 'user_id' => 3, 'type' => 'comment', 'content' => '<t>d</t>', 'number' => 4, 'created_at' => $now, 'hidden_at' => $now],
                ['id' => 5, 'discussion_id' => 1, 'user_id' => 4, 'type' => 'comment', 'content' => '<t>e</t>', 'number' => 5, 'created_at' => $now, 'is_private' => 1],
            ],
            'post_likes' => [
                ['post_id' => 1, 'user_id' => 2],
                ['post_id' => 2, 'user_id' => 1],
                ['post_id' => 4, 'user_id' => 1],
                ['post_id' => 5, 'user_id' => 1],
            ],
        ]);
    }

    /**
     * Participantes distintos e curtidas só dos comentários visíveis a todos.
     */
    #[Test]
    public function mapa_conta_so_o_que_todos_veem(): void
    {
        foreach ([1, 2] as $actor) {
            $attributes = json_decode((string) $this->send($this->request('GET', '/api/discussions/1', ['authenticatedAs' => $actor]))->getBody(), true)['data']['attributes'];

            $this->assertSame(2, $attributes['participantCount'], "ator $actor");
            $this->assertSame(2, $attributes['canelaLikeCount'], "ator $actor");
        }
    }

    /**
     * Na lista os números não vêm (seriam consultas por linha).
     */
    #[Test]
    public function mapa_nao_vem_na_lista(): void
    {
        $attributes = json_decode((string) $this->send($this->request('GET', '/api/discussions', ['authenticatedAs' => 2]))->getBody(), true)['data'][0]['attributes'];

        $this->assertArrayNotHasKey('participantCount', $attributes);
        $this->assertArrayNotHasKey('canelaLikeCount', $attributes);
    }
}
