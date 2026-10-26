<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Links;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * Cliques em links externos: `POST /api/canela-link-click` responde sempre
 * 204 sem redirecionar para lugar nenhum (não é um "redirecionador aberto"),
 * e só grava o clique quando o link está mesmo na postagem, é externo, a
 * postagem é visível para quem clicou e não é clique repetido. O tópico expõe
 * os cliques em `canelaLinks`, contando só postagens públicas.
 */
class LinkClicksTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    private const BROWSER = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

    private const LINK = 'https://example.com/artigo';

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $now = Carbon::now();
        $xml = fn (string ...$urls) => '<r>'.implode(' ', array_map(fn ($u) => '<URL url="'.htmlspecialchars($u).'">'.htmlspecialchars($u).'</URL>', $urls)).'</r>';

        $this->prepareDatabase([
            User::class => [$this->normalUser()],
            Discussion::class => [
                ['id' => 1, 'title' => 'Com links', 'user_id' => 1, 'created_at' => $now, 'last_posted_at' => $now, 'comment_count' => 2, 'first_post_id' => 1, 'last_post_number' => 3],
                ['id' => 2, 'title' => 'Oculto', 'user_id' => 1, 'created_at' => $now, 'last_posted_at' => $now, 'comment_count' => 1, 'first_post_id' => 4, 'last_post_number' => 1, 'hidden_at' => $now],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'number' => 1, 'created_at' => $now, 'content' => $xml(self::LINK, 'http://localhost/d/1', 'https://outro.example.org/x')],
                ['id' => 2, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'number' => 2, 'created_at' => $now, 'content' => $xml('https://escondido.example.net/'), 'hidden_at' => $now],
                ['id' => 3, 'discussion_id' => 1, 'user_id' => 1, 'type' => 'comment', 'number' => 3, 'created_at' => $now, 'content' => $xml(self::LINK)],
                ['id' => 4, 'discussion_id' => 2, 'user_id' => 1, 'type' => 'comment', 'number' => 1, 'created_at' => $now, 'content' => $xml(self::LINK)],
            ],
        ]);
    }

    private function click(int $postId, string $url, ?int $as = 2, string $agent = self::BROWSER): ResponseInterface
    {
        return $this->send(
            $this->request('POST', '/api/canela-link-click', ($as ? ['authenticatedAs' => $as] : []) + [
                'json' => ['post_id' => $postId, 'url' => $url],
            ])->withHeader('User-Agent', $agent)
        );
    }

    private function clicks(): int
    {
        return $this->database()->table('canela_link_clicks')->count();
    }

    /**
     * O clique válido grava uma linha, com o hash do endereço e quem clicou.
     */
    #[Test]
    public function clique_valido_e_registrado(): void
    {
        $response = $this->click(1, self::LINK);

        $this->assertEquals(204, $response->getStatusCode());

        $row = $this->database()->table('canela_link_clicks')->first();
        $this->assertNotNull($row);
        $this->assertSame(1, (int) $row->post_id);
        $this->assertSame(1, (int) $row->discussion_id);
        $this->assertSame(2, (int) $row->user_id);
        $this->assertSame(sha1(self::LINK), $row->url_hash);
    }

    /**
     * A rota não redireciona: nem com um endereço que a postagem tem, nem com
     * um qualquer. Responde 204 vazio, sem `Location`.
     */
    #[Test]
    public function rota_nunca_redireciona(): void
    {
        foreach ([self::LINK, 'https://malicioso.example/phish', '//malicioso.example', 'javascript:alert(1)'] as $url) {
            $response = $this->click(1, $url);

            $this->assertEquals(204, $response->getStatusCode(), $url);
            $this->assertFalse($response->hasHeader('Location'), $url);
            $this->assertSame('', (string) $response->getBody(), $url);
        }
    }

    /**
     * Endereço que não está na postagem não conta: ninguém infla os números
     * de um link qualquer.
     */
    #[Test]
    public function link_que_nao_esta_na_postagem_nao_conta(): void
    {
        $this->click(1, 'https://malicioso.example/phish');
        $this->click(3, 'https://outro.example.org/x');

        $this->assertSame(0, $this->clicks());
    }

    /**
     * Links internos (do próprio fórum) e esquemas que não são http(s) ficam
     * de fora.
     */
    #[Test]
    public function links_internos_e_esquemas_estranhos_nao_contam(): void
    {
        $this->click(1, 'http://localhost/d/1');
        $this->click(1, 'javascript:alert(1)');
        $this->click(1, 'ftp://example.com/');

        $this->assertSame(0, $this->clicks());
    }

    /**
     * Postagem oculta ou de tópico oculto: quem não a vê não registra clique.
     */
    #[Test]
    public function postagem_invisivel_nao_conta(): void
    {
        $this->click(2, 'https://escondido.example.net/');
        $this->click(4, self::LINK);
        $this->click(999, self::LINK);

        $this->assertSame(0, $this->clicks());
    }

    /**
     * A mesma pessoa clicando de novo no mesmo link da mesma postagem conta
     * uma vez; em outra postagem, conta de novo.
     */
    #[Test]
    public function clique_repetido_conta_uma_vez(): void
    {
        $this->click(1, self::LINK);
        $this->click(1, self::LINK);
        $this->click(3, self::LINK);

        $this->assertSame(2, $this->clicks());
    }

    /**
     * Robô não conta.
     */
    #[Test]
    public function robo_nao_conta(): void
    {
        $this->click(1, self::LINK, 2, 'Mozilla/5.0 (compatible; bingbot/2.0)');
        $this->click(1, self::LINK, 2, '');

        $this->assertSame(0, $this->clicks());
    }

    /**
     * Desligado no admin: a rota não existe e o atributo some do tópico.
     */
    #[Test]
    public function desligado_responde_404_e_esconde_o_atributo(): void
    {
        $this->setting('canela.stats_links_enabled', false);

        $this->assertEquals(404, $this->click(1, self::LINK)->getStatusCode());
        $this->assertSame(0, $this->clicks());

        $json = json_decode((string) $this->send($this->request('GET', '/api/discussions/1', ['authenticatedAs' => 2]))->getBody(), true);
        $this->assertArrayNotHasKey('canelaLinks', $json['data']['attributes']);
    }

    /**
     * `canelaLinks` no tópico: só links externos de postagens visíveis a
     * todos, mais clicados primeiro, com os cliques por postagem.
     */
    #[Test]
    public function campo_do_topico_lista_os_links_mais_clicados(): void
    {
        $this->click(1, 'https://outro.example.org/x');
        $this->click(1, 'https://outro.example.org/x', 1);
        $this->click(1, self::LINK);

        $response = $this->send($this->request('GET', '/api/discussions/1', ['authenticatedAs' => 2]));
        $links = json_decode((string) $response->getBody(), true)['data']['attributes']['canelaLinks'];

        $this->assertSame(2, $links['total']);
        $this->assertSame(['https://outro.example.org/x', self::LINK], array_column($links['top'], 'url'));
        $this->assertSame([2, 1], array_column($links['top'], 'clicks'));
        $this->assertSame('example.com', $links['top'][1]['domain']);
        $perPost = $links['posts']['1'];
        ksort($perPost);
        $this->assertSame([self::LINK => 1, 'https://outro.example.org/x' => 2], $perPost);

        // O link da postagem oculta e o interno nunca aparecem.
        $urls = array_column($links['top'], 'url');
        $this->assertNotContains('https://escondido.example.net/', $urls);
        $this->assertNotContains('http://localhost/d/1', $urls);
    }

    /**
     * Na listagem de tópicos o campo não vem (só na página do tópico).
     */
    #[Test]
    public function campo_nao_vem_na_lista(): void
    {
        $json = json_decode((string) $this->send($this->request('GET', '/api/discussions', ['authenticatedAs' => 2]))->getBody(), true);

        $this->assertArrayNotHasKey('canelaLinks', $json['data'][0]['attributes']);
    }
}
