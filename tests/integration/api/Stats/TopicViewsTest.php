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
use Psr\Http\Message\ServerRequestInterface;

/**
 * Visualizações de tópico: abrir o tópico pela API (Show) conta uma
 * visualização por pessoa/visitante dentro da janela de horas, robôs não
 * contam, o atributo `viewCount` some quando o recurso está desligado e o
 * gráfico por dia (`/canela-views`) respeita a visibilidade do tópico.
 */
class TopicViewsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    private const BROWSER = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outra', 'email' => 'outra@machine.local', 'is_email_confirmed' => 1],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Público', 'user_id' => 1, 'created_at' => Carbon::now(), 'comment_count' => 1, 'first_post_id' => 1, 'last_post_number' => 1, 'canela_view_count' => 10],
                ['id' => 2, 'title' => 'Oculto', 'user_id' => 1, 'created_at' => Carbon::now(), 'comment_count' => 1, 'first_post_id' => 2, 'last_post_number' => 1, 'hidden_at' => Carbon::now(), 'canela_view_count' => 77],
                ['id' => 3, 'title' => 'Privado', 'user_id' => 1, 'created_at' => Carbon::now(), 'comment_count' => 1, 'first_post_id' => 3, 'last_post_number' => 1, 'is_private' => 1, 'canela_view_count' => 5],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>a</t>', 'number' => 1, 'created_at' => Carbon::now()],
                ['id' => 2, 'discussion_id' => 2, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>b</t>', 'number' => 1, 'created_at' => Carbon::now()],
                ['id' => 3, 'discussion_id' => 3, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>c</t>', 'number' => 1, 'created_at' => Carbon::now(), 'is_private' => 1],
            ],
        ]);
    }

    private function show(int $id, ?int $as = null, string $agent = self::BROWSER): \Psr\Http\Message\ResponseInterface
    {
        $request = $this->request('GET', "/api/discussions/$id", $as ? ['authenticatedAs' => $as] : []);

        return $this->send($this->browser($request, $agent));
    }

    private function browser(ServerRequestInterface $request, string $agent = self::BROWSER): ServerRequestInterface
    {
        return $request->withHeader('User-Agent', $agent);
    }

    private function storedViews(int $id): int
    {
        return (int) $this->database()->table('discussions')->where('id', $id)->value('canela_view_count');
    }

    /**
     * A primeira abertura conta, e o número já volta somado na própria resposta.
     */
    #[Test]
    public function abrir_o_topico_conta_uma_visualizacao(): void
    {
        $response = $this->show(1, 2);

        $this->assertEquals(200, $response->getStatusCode());
        $json = json_decode((string) $response->getBody(), true);

        $this->assertSame(11, $json['data']['attributes']['viewCount']);
        $this->assertSame(11, $this->storedViews(1));
        $this->assertSame(1, $this->database()->table('canela_topic_views')->where('discussion_id', 1)->where('user_id', 2)->count());
    }

    /**
     * A mesma pessoa abrindo de novo dentro da janela não conta outra vez;
     * outra pessoa conta.
     */
    #[Test]
    public function mesma_pessoa_na_janela_conta_uma_vez_so(): void
    {
        $this->show(1, 2);
        $this->show(1, 2);
        $this->show(1, 2);
        $this->show(1, 3);

        $this->assertSame(12, $this->storedViews(1));
    }

    /**
     * Visitante (sem conta) conta pelo IP com hash: a tabela não guarda o IP cru.
     */
    #[Test]
    public function visitante_conta_pelo_hash_do_ip(): void
    {
        $this->show(1);
        $this->show(1);

        $this->assertSame(11, $this->storedViews(1));

        $row = $this->database()->table('canela_topic_views')->where('discussion_id', 1)->whereNull('user_id')->first();
        $this->assertNotNull($row);
        $this->assertNotEmpty($row->ip_hash);
    }

    /**
     * Passada a janela de horas, a mesma pessoa conta de novo.
     */
    #[Test]
    public function depois_da_janela_conta_de_novo(): void
    {
        $this->setting('canela.stats_view_window_hours', 1);

        $this->database()->table('canela_topic_views')->insert([
            'discussion_id' => 1, 'user_id' => 2, 'ip_hash' => null, 'viewed_at' => Carbon::now()->subHours(2),
        ]);

        $this->show(1, 2);

        $this->assertSame(11, $this->storedViews(1));
    }

    /**
     * Robôs e requisições sem User-Agent não inflam o número.
     */
    #[Test]
    public function robos_e_scripts_nao_contam(): void
    {
        $this->show(1, null, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)');
        $this->show(1, null, 'curl/8.0');
        $this->show(1, 2, '');

        $this->assertSame(10, $this->storedViews(1));
    }

    /**
     * Desligado no admin: nada é contado e o atributo some da resposta.
     */
    #[Test]
    public function desligado_nao_conta_e_esconde_o_atributo(): void
    {
        $this->setting('canela.stats_views_enabled', false);

        $response = $this->show(1, 2);
        $json = json_decode((string) $response->getBody(), true);

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertArrayNotHasKey('viewCount', $json['data']['attributes']);
        $this->assertSame(10, $this->storedViews(1));
    }

    /**
     * Tópico oculto não abre para quem não pode vê-lo, e a tentativa não
     * conta visualização nem vaza o número.
     */
    #[Test]
    public function topico_oculto_nao_conta_nem_vaza(): void
    {
        $response = $this->show(2, 2);

        $this->assertEquals(404, $response->getStatusCode());
        $this->assertStringNotContainsString('viewCount', (string) $response->getBody());
        $this->assertSame(77, $this->storedViews(2));
    }

    /**
     * O gráfico por dia registra a visualização do dia e devolve a série.
     */
    #[Test]
    public function grafico_por_dia_traz_a_visualizacao_de_hoje(): void
    {
        $this->show(1, 2);
        $this->show(1);

        $response = $this->send($this->request('GET', '/api/discussions/1/canela-views', ['authenticatedAs' => 2]));

        $this->assertEquals(200, $response->getStatusCode());
        $json = json_decode((string) $response->getBody(), true);

        $this->assertSame(1, $json['topic_id']);
        $this->assertCount(1, $json['stats']);
        $this->assertSame(Carbon::now()->toDateString(), $json['stats'][0]['viewed_at']);
        $this->assertSame(2, $json['stats'][0]['views']);
    }

    /**
     * O gráfico de um tópico privado ou oculto não abre para quem não o vê.
     */
    #[Test]
    public function grafico_de_topico_invisivel_responde_404(): void
    {
        foreach ([2, 3] as $id) {
            $response = $this->send($this->request('GET', "/api/discussions/$id/canela-views", ['authenticatedAs' => 2]));
            $this->assertEquals(404, $response->getStatusCode(), "tópico $id");
        }

        // O admin vê o oculto.
        $response = $this->send($this->request('GET', '/api/discussions/2/canela-views', ['authenticatedAs' => 1]));
        $this->assertEquals(200, $response->getStatusCode());
    }

    /**
     * Desligado, a rota do gráfico "não existe".
     */
    #[Test]
    public function grafico_desligado_responde_404(): void
    {
        $this->setting('canela.stats_views_enabled', false);

        $response = $this->send($this->request('GET', '/api/discussions/1/canela-views', ['authenticatedAs' => 1]));

        $this->assertEquals(404, $response->getStatusCode());
    }

    /**
     * `sort=-viewCount` ordena a lista pelo número de visualizações.
     */
    #[Test]
    public function lista_ordena_por_visualizacoes(): void
    {
        $this->database()->table('discussions')->where('id', 1)->update(['canela_view_count' => 3]);
        $now = Carbon::now();
        foreach ([[4, 500], [5, 1]] as [$id, $views]) {
            $this->database()->table('discussions')->insert(['id' => $id, 'title' => "Tópico $id", 'slug' => "t$id", 'user_id' => 1, 'created_at' => $now, 'last_posted_at' => $now, 'comment_count' => 1, 'last_post_number' => 1, 'canela_view_count' => $views]);
            $this->database()->table('posts')->insert(['id' => $id, 'discussion_id' => $id, 'user_id' => 1, 'type' => 'comment', 'content' => '<t>x</t>', 'number' => 1, 'created_at' => $now]);
        }

        $response = $this->send($this->request('GET', '/api/discussions', ['authenticatedAs' => 2])->withQueryParams(['sort' => '-viewCount']));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $ids = array_map('intval', array_column(json_decode((string) $response->getBody(), true)['data'], 'id'));

        $this->assertSame([4, 1, 5], $ids);
    }
}
