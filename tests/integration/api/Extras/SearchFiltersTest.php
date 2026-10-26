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

/**
 * Os filtros que o tema soma à busca de tópicos: mínimo de respostas, só no
 * título, curtidos por mim e a ordenação por curtidas (com o flarum/likes).
 * Nenhum deles traz tópico que a pessoa não pode ver.
 *
 * Cenário:
 * - 1: "Receita de bolo", 5 comentários, primeiro post com 2 curtidas (uma de normal);
 * - 2: "Dúvida sobre bolo", 1 comentário, sem curtidas;
 * - 3: "Outro assunto", 3 comentários, "bolo" só no texto, 1 curtida;
 * - 4: oculto, 9 comentários, "Receita secreta" (curtido por normal).
 */
class SearchFiltersTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('flarum-likes', 'ramon-canela');

        $now = Carbon::now();
        $discussion = fn (int $id, string $title, int $comments, array $extra = []) => $extra + [
            'id' => $id, 'title' => $title, 'user_id' => 1, 'created_at' => $now, 'last_posted_at' => $now->copy()->subMinutes($id),
            'comment_count' => $comments, 'first_post_id' => $id, 'last_post_number' => 1,
        ];

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outra', 'email' => 'outra@machine.local', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                $discussion(1, 'Receita de bolo', 5),
                $discussion(2, 'Dúvida sobre bolo', 1),
                $discussion(3, 'Outro assunto', 3),
                $discussion(4, 'Receita secreta', 9, ['hidden_at' => $now]),
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Farinha e ovos</t>', 'number' => 1, 'created_at' => $now],
                ['id' => 2, 'discussion_id' => 2, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Como faço?</t>', 'number' => 1, 'created_at' => $now],
                ['id' => 3, 'discussion_id' => 3, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Falando de bolo aqui no texto</t>', 'number' => 1, 'created_at' => $now],
                ['id' => 4, 'discussion_id' => 4, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>Receita de bolo</t>', 'number' => 1, 'created_at' => $now],
            ],
            'post_likes' => [
                ['post_id' => 1, 'user_id' => 2],
                ['post_id' => 1, 'user_id' => 3],
                ['post_id' => 3, 'user_id' => 3],
                ['post_id' => 4, 'user_id' => 2],
            ],
        ]);
    }

    private function ids(array $query, ?int $as = 2): array
    {
        $response = $this->send($this->request('GET', '/api/discussions', $as ? ['authenticatedAs' => $as] : [])->withQueryParams($query));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return array_map('intval', array_column(json_decode((string) $response->getBody(), true)['data'], 'id'));
    }

    /**
     * Mínimo de respostas; negado, vira "menos de N". O oculto (9) não aparece.
     */
    #[Test]
    public function minimo_de_respostas(): void
    {
        $this->assertEqualsCanonicalizing([1, 3], $this->ids(['filter' => ['canelaMinPosts' => '3']]));
        $this->assertSame([2], $this->ids(['filter' => ['-canelaMinPosts' => '3']]));
    }

    /**
     * Admin vê o oculto quando ele atende ao filtro.
     */
    #[Test]
    public function minimo_de_respostas_respeita_a_visibilidade(): void
    {
        $this->assertSame([4], $this->ids(['filter' => ['canelaMinPosts' => '9']], 1));
        $this->assertSame([], $this->ids(['filter' => ['canelaMinPosts' => '9']]));
    }

    /**
     * "Só no título": o tópico que fala de bolo só no texto fica de fora.
     */
    #[Test]
    public function busca_so_no_titulo(): void
    {
        $everywhere = $this->ids(['filter' => ['q' => 'bolo']]);
        $this->assertContains(3, $everywhere);

        $this->assertEqualsCanonicalizing([1, 2], $this->ids(['filter' => ['q' => 'bolo', 'canelaInTitle' => '1']]));
    }

    /**
     * Os curingas do LIKE vêm escapados: "%" procura o caractere.
     */
    #[Test]
    public function busca_no_titulo_escapa_curingas(): void
    {
        $this->assertSame([], $this->ids(['filter' => ['q' => '%', 'canelaInTitle' => '1']]));
    }

    /**
     * "Curtidos por mim": só tópicos com post que a pessoa curtiu e que ela vê.
     */
    #[Test]
    public function curtidos_por_mim(): void
    {
        $this->assertSame([1], $this->ids(['filter' => ['canelaLiked' => '1']]));
        $this->assertEqualsCanonicalizing([1, 3], $this->ids(['filter' => ['canelaLiked' => '1']], 3));
    }

    /**
     * Visitante não curtiu nada: o filtro não acha nada.
     */
    #[Test]
    public function visitante_nao_tem_curtidos(): void
    {
        $this->assertSame([], $this->ids(['filter' => ['canelaLiked' => '1']], null));
    }

    /**
     * Ordenar por curtidas do primeiro post.
     */
    #[Test]
    public function ordena_por_curtidas(): void
    {
        $this->assertSame([1, 3, 2], $this->ids(['sort' => '-canelaLikes']));
    }

    /**
     * "Marcados por mim" sem marcadores não acha nada (e o visitante, nunca).
     */
    #[Test]
    public function marcados_sem_marcadores_nao_acha_nada(): void
    {
        $this->assertSame([], $this->ids(['filter' => ['canelaBookmarked' => '1']]));
        $this->assertSame([], $this->ids(['filter' => ['canelaBookmarked' => '1']], null));
    }
}
