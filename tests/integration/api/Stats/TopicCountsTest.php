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
 * As contagens "Novos (N)" e "Não lidos (N)" e o tempo de leitura: só para
 * quem tem conta, só sobre tópicos que a pessoa pode ver, e cada parte
 * desligada no admin some (rota 404, atributo ausente).
 *
 * Cenário (o ator é a pessoa 2):
 * - 1: novo de outra pessoa, nunca aberto → novo;
 * - 2: aberto até a 1, já tem 3 → não lido;
 * - 3: aberto e lido até o fim → nem novo nem não lido;
 * - 4: escrito pela própria pessoa → não é novo;
 * - 5: oculto; 6: privado → nunca entram.
 */
class TopicCountsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $now = Carbon::now();
        $discussion = fn (int $id, int $user, int $last, array $extra = []) => $extra + [
            'id' => $id, 'title' => "Tópico $id", 'user_id' => $user, 'created_at' => $now, 'last_posted_at' => $now,
            'comment_count' => $last, 'first_post_id' => $id * 10 + 1, 'last_post_number' => $last,
        ];

        $posts = [];
        foreach ([1 => 1, 2 => 3, 3 => 2, 4 => 1, 5 => 1, 6 => 1] as $id => $count) {
            for ($n = 1; $n <= $count; $n++) {
                $posts[] = ['id' => $id * 10 + $n, 'discussion_id' => $id, 'user_id' => 3, 'type' => 'comment', 'content' => '<t>x</t>', 'number' => $n, 'created_at' => $now, 'is_private' => $id === 6 ? 1 : 0];
            }
        }

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'autora', 'email' => 'autora@machine.local', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                $discussion(1, 3, 1),
                $discussion(2, 3, 3),
                $discussion(3, 3, 2),
                $discussion(4, 2, 1),
                $discussion(5, 3, 1, ['hidden_at' => $now]),
                $discussion(6, 3, 1, ['is_private' => 1]),
            ],
            Post::class => $posts,
            'discussion_user' => [
                ['discussion_id' => 2, 'user_id' => 2, 'last_read_post_number' => 1, 'last_read_at' => $now],
                ['discussion_id' => 3, 'user_id' => 2, 'last_read_post_number' => 2, 'last_read_at' => $now],
                ['discussion_id' => 5, 'user_id' => 2, 'last_read_post_number' => 0, 'last_read_at' => $now],
                ['discussion_id' => 6, 'user_id' => 2, 'last_read_post_number' => 0, 'last_read_at' => $now],
            ],
        ]);
    }

    private function json($response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    /**
     * Visitante não tem contagem pessoal: a rota pede login.
     */
    #[Test]
    public function visitante_nao_pode_ver_as_contagens(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-counts'));

        $this->assertEquals(401, $response->getStatusCode());
    }

    /**
     * Novo = criado na janela, de outra pessoa, nunca aberto; não lido = aberto
     * mas com resposta depois da última lida. Oculto e privado não contam.
     */
    #[Test]
    public function contagens_seguem_a_regra_e_a_visibilidade(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-counts', ['authenticatedAs' => 2]));

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertSame(['new' => 1, 'unread' => 1, 'limit' => 100], $this->json($response));
    }

    /**
     * As mesmas contagens chegam no documento do fórum para quem está logado,
     * e não aparecem para o visitante.
     */
    #[Test]
    public function forum_traz_as_contagens_so_para_quem_esta_logado(): void
    {
        $attributes = $this->json($this->send($this->request('GET', '/api', ['authenticatedAs' => 2])))['data']['attributes'];
        $this->assertSame(1, $attributes['canelaNewCount']);
        $this->assertSame(1, $attributes['canelaUnreadCount']);

        $guest = $this->json($this->send($this->request('GET', '/api')))['data']['attributes'];
        $this->assertArrayNotHasKey('canelaNewCount', $guest);
        $this->assertArrayNotHasKey('canelaUnreadCount', $guest);
    }

    /**
     * Fora da janela de "novo" (dias configurados), o tópico deixa de ser novo.
     */
    #[Test]
    public function topico_antigo_nao_e_novo(): void
    {
        $this->setting('canela.stats_new_days', 1);
        $this->database()->table('discussions')->where('id', 1)->update(['created_at' => Carbon::now()->subDays(3)]);

        $response = $this->send($this->request('GET', '/api/canela-counts', ['authenticatedAs' => 2]));

        $this->assertSame(0, $this->json($response)['new']);
    }

    /**
     * As abas "Novos" e "Não lidos" listam pela mesma regra das contagens.
     */
    #[Test]
    public function filtros_da_lista_seguem_a_mesma_regra(): void
    {
        $new = $this->send($this->request('GET', '/api/discussions', ['authenticatedAs' => 2])->withQueryParams(['filter' => ['canelaNew' => '1']]));
        $this->assertEquals(200, $new->getStatusCode(), (string) $new->getBody());
        $this->assertSame(['1'], array_column($this->json($new)['data'], 'id'));

        $unread = $this->send($this->request('GET', '/api/discussions', ['authenticatedAs' => 2])->withQueryParams(['filter' => ['canelaUnread' => '1']]));
        $this->assertEquals(200, $unread->getStatusCode(), (string) $unread->getBody());
        $this->assertSame(['2'], array_column($this->json($unread)['data'], 'id'));
    }

    /**
     * Desligadas no admin, a rota responde 404 e os atributos somem.
     */
    #[Test]
    public function contagens_desligadas_somem(): void
    {
        $this->setting('canela.stats_counts_enabled', false);

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-counts', ['authenticatedAs' => 2]))->getStatusCode());

        $attributes = $this->json($this->send($this->request('GET', '/api', ['authenticatedAs' => 2])))['data']['attributes'];
        $this->assertArrayNotHasKey('canelaNewCount', $attributes);
    }

    /**
     * Tempo de leitura: visitante não registra nada.
     */
    #[Test]
    public function visitante_nao_registra_tempo_de_leitura(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-read-time', [
            'json' => ['discussionId' => 1, 'seconds' => 30, 'postIds' => [11]],
        ]));

        // 400 (sem token CSRF de sessão) ou 401 (sem conta): nunca grava.
        $this->assertContains($response->getStatusCode(), [400, 401]);
        $this->assertSame(0, $this->database()->table('canela_user_visits')->count());
    }

    /**
     * Tempo de leitura soma ao dia, com teto por envio, e só conta postagens
     * do próprio tópico (uma vez cada).
     */
    #[Test]
    public function tempo_de_leitura_soma_com_tetos(): void
    {
        $response = $this->send($this->request('POST', '/api/canela-read-time', [
            'authenticatedAs' => 2,
            // 21-23 são do tópico 2, 11 é do 1: não conta. 9999 nem existe.
            'json' => ['discussionId' => 2, 'seconds' => 9999, 'postIds' => [21, 22, 22, 23, 11, 9999]],
        ]));

        $this->assertEquals(204, $response->getStatusCode(), (string) $response->getBody());

        $row = $this->database()->table('canela_user_visits')->where('user_id', 2)->first();
        $this->assertNotNull($row);
        $this->assertLessThanOrEqual(60, (int) $row->time_read);
        $this->assertGreaterThan(0, (int) $row->time_read);
        $this->assertSame(3, (int) $row->posts_read);
    }

    /**
     * O crédito é ler-somar-gravar no cache: com outro envio da mesma pessoa
     * em andamento (a trava dela ocupada), este espera e, sem a trava, não
     * credita nada — em vez de as duas abas ganharem o crédito inteiro. Livre
     * a trava, o próximo envio credita normalmente.
     */
    #[Test]
    public function tempo_de_leitura_e_creditado_um_envio_por_vez(): void
    {
        $this->app();
        $store = $this->app()->getContainer()->make(\Illuminate\Contracts\Cache\Repository::class)->getStore();
        $this->assertInstanceOf(\Illuminate\Contracts\Cache\LockProvider::class, $store);

        $lock = $store->lock('canela.stats.read_lock.2', 30);
        $this->assertTrue($lock->get());

        $send = fn () => $this->send($this->request('POST', '/api/canela-read-time', [
            'authenticatedAs' => 2,
            'json' => ['discussionId' => 2, 'seconds' => 30, 'postIds' => [21]],
        ]));

        $this->assertEquals(204, $send()->getStatusCode());
        $this->assertSame(0, (int) $this->database()->table('canela_user_visits')->where('user_id', 2)->sum('time_read'));
        $this->assertSame(0, (int) $this->database()->table('canela_user_visits')->where('user_id', 2)->sum('posts_read'));

        $lock->release();

        $this->assertEquals(204, $send()->getStatusCode());
        $this->assertSame(30, (int) $this->database()->table('canela_user_visits')->where('user_id', 2)->sum('time_read'));
        $this->assertSame(1, (int) $this->database()->table('canela_user_visits')->where('user_id', 2)->sum('posts_read'));
    }

    /**
     * Tempo de leitura em tópico que a pessoa não vê responde 404, sem somar.
     */
    #[Test]
    public function tempo_de_leitura_em_topico_invisivel_responde_404(): void
    {
        foreach ([5, 6] as $id) {
            $response = $this->send($this->request('POST', '/api/canela-read-time', [
                'authenticatedAs' => 2,
                'json' => ['discussionId' => $id, 'seconds' => 30, 'postIds' => [$id * 10 + 1]],
            ]));

            $this->assertEquals(404, $response->getStatusCode(), "tópico $id");
        }

        $this->assertSame(0, (int) $this->database()->table('canela_user_visits')->where('user_id', 2)->sum('posts_read'));
    }

    /**
     * Com a atividade desligada, a rota do tempo de leitura não existe.
     */
    #[Test]
    public function tempo_de_leitura_desligado_responde_404(): void
    {
        $this->setting('canela.stats_activity_enabled', false);

        $response = $this->send($this->request('POST', '/api/canela-read-time', [
            'authenticatedAs' => 2,
            'json' => ['discussionId' => 1, 'seconds' => 30],
        ]));

        $this->assertEquals(404, $response->getStatusCode());
    }
}
