<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Community;

use Carbon\Carbon;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * O diretório de usuários (/api/canela-directory e a página /u): quem pode
 * listar, os filtros (período, busca), as ordenações permitidas e o que fica
 * de fora (contas não confirmadas, tópicos ocultos, "visto por último" de
 * quem esconde que está online).
 */
class DirectoryTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser() + ['last_seen_at' => Carbon::now()->subMinutes(5)],
                ['id' => 3, 'username' => 'ana', 'email' => 'ana@machine.local', 'is_email_confirmed' => 1, 'last_seen_at' => Carbon::now()->subMinutes(2), 'preferences' => json_encode(['discloseOnline' => false])],
                ['id' => 4, 'username' => 'bruno', 'email' => 'bruno@machine.local', 'is_email_confirmed' => 1, 'last_seen_at' => Carbon::now()->subDay()],
                ['id' => 5, 'username' => 'naoconfirmado', 'email' => 'nc@machine.local', 'is_email_confirmed' => 0],
            ],
            Discussion::class => [
                ['id' => 1, 'title' => 'Um', 'created_at' => Carbon::now()->subDays(2), 'last_posted_at' => Carbon::now(), 'user_id' => 4, 'first_post_id' => 1, 'comment_count' => 2],
                ['id' => 2, 'title' => 'Dois', 'created_at' => Carbon::now()->subDays(100), 'last_posted_at' => Carbon::now(), 'user_id' => 4, 'first_post_id' => 2, 'comment_count' => 1],
                ['id' => 3, 'title' => 'Oculto', 'created_at' => Carbon::now(), 'last_posted_at' => Carbon::now(), 'user_id' => 3, 'first_post_id' => 4, 'comment_count' => 1, 'hidden_at' => Carbon::now()],
            ],
            Post::class => [
                ['id' => 1, 'discussion_id' => 1, 'created_at' => Carbon::now()->subDays(2), 'user_id' => 4, 'type' => 'comment', 'content' => '<t><p>a</p></t>', 'number' => 1],
                ['id' => 2, 'discussion_id' => 2, 'created_at' => Carbon::now()->subDays(100), 'user_id' => 4, 'type' => 'comment', 'content' => '<t><p>b</p></t>', 'number' => 1],
                ['id' => 3, 'discussion_id' => 1, 'created_at' => Carbon::now()->subDay(), 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>c</p></t>', 'number' => 2],
                ['id' => 4, 'discussion_id' => 3, 'created_at' => Carbon::now(), 'user_id' => 3, 'type' => 'comment', 'content' => '<t><p>d</p></t>', 'number' => 1],
            ],
        ]);
    }

    private function directory(?int $actor, array $query = []): ResponseInterface
    {
        $request = $this->request('GET', '/api/canela-directory', $actor ? ['authenticatedAs' => $actor] : []);

        return $this->send($request->withQueryParams($query));
    }

    private function json(ResponseInterface $response): array
    {
        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return json_decode((string) $response->getBody(), true);
    }

    /** @return array<string, array<string, mixed>> as linhas do diretório, pelo nome de usuário */
    private function rows(array $body): array
    {
        $names = [];

        foreach ($body['included'] as $user) {
            $names[$user['id']] = $user['attributes']['username'];
        }

        $rows = [];

        foreach ($body['data'] as $row) {
            $rows[$names[$row['user']]] = $row;
        }

        return $rows;
    }

    /**
     * Por padrão, só membros listam usuários (a permissão searchUsers do
     * core): visitante recebe 403.
     */
    #[Test]
    public function visitante_nao_lista_por_padrao(): void
    {
        $this->assertEquals(403, $this->directory(null)->getStatusCode());
    }

    /**
     * Com canela.directory_guests ligada, o visitante também lista.
     */
    #[Test]
    public function visitante_lista_quando_o_admin_libera(): void
    {
        $this->setting('canela.directory_guests', true);

        $this->assertNotEmpty($this->json($this->directory(null))['data']);
    }

    /**
     * Fórum fechado a visitantes: a liberação do diretório não vale.
     */
    #[Test]
    public function forum_fechado_nao_abre_o_diretorio(): void
    {
        $this->setting('canela.directory_guests', true);
        $this->database()->table('group_permission')->where('permission', 'viewForum')->where('group_id', 2)->delete();

        $this->assertEquals(403, $this->directory(null)->getStatusCode());
    }

    /**
     * Membro lista; contas não confirmadas ficam de fora.
     */
    #[Test]
    public function membro_lista_sem_contas_nao_confirmadas(): void
    {
        $body = $this->json($this->directory(2));
        $rows = $this->rows($body);

        $this->assertArrayHasKey('ana', $rows);
        $this->assertArrayHasKey('bruno', $rows);
        $this->assertArrayNotHasKey('naoconfirmado', $rows);
        $this->assertSame(count($rows), $body['meta']['total']);
    }

    /**
     * Diretório desligado no admin: 404, não 403.
     */
    #[Test]
    public function diretorio_desligado_responde_404(): void
    {
        $this->setting('canela.directory_enabled', false);

        $this->assertEquals(404, $this->directory(1)->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/u'))->getStatusCode());
    }

    /**
     * Tópicos e respostas contam só o que é público: o tópico oculto da Ana
     * não entra, e "respostas" não contam a primeira postagem.
     */
    #[Test]
    public function contagens_ignoram_conteudo_oculto(): void
    {
        $rows = $this->rows($this->json($this->directory(2)));

        $this->assertSame(2, $rows['bruno']['topicCount']);
        $this->assertSame(0, $rows['bruno']['postCount']);
        $this->assertSame(0, $rows['ana']['topicCount']);
        $this->assertSame(1, $rows['ana']['postCount']);
    }

    /**
     * O período restringe as contagens: no mês, o tópico de 100 dias atrás sai.
     */
    #[Test]
    public function periodo_filtra_as_contagens(): void
    {
        $body = $this->json($this->directory(2, ['period' => 'monthly']));

        $this->assertSame('monthly', $body['meta']['period']);
        $this->assertSame(1, $this->rows($body)['bruno']['topicCount']);
    }

    /**
     * Valores inválidos na URL caem no padrão em vez de dar erro.
     */
    #[Test]
    public function parametros_invalidos_caem_no_padrao(): void
    {
        $body = $this->json($this->directory(2, ['period' => 'secular', 'order' => 'password', 'page' => '-3']));

        $this->assertSame('all', $body['meta']['period']);
        $this->assertSame('postCount', $body['meta']['order']);
        $this->assertSame(1, $body['meta']['page']);
    }

    /**
     * Busca pelo nome e ordenação por nome (A–Z por padrão).
     */
    #[Test]
    public function busca_e_ordena_por_nome(): void
    {
        $body = $this->json($this->directory(2, ['q' => 'brun']));

        $this->assertSame(['bruno'], array_keys($this->rows($body)));

        $body = $this->json($this->directory(2, ['order' => 'username']));

        $this->assertSame('asc', $body['meta']['dir']);
        $this->assertSame(['admin', 'ana', 'bruno', 'normal'], array_column(array_column($body['included'], 'attributes'), 'username'));
    }

    /**
     * Ordenar por "visto por último" exige a permissão user.viewLastSeenAt:
     * para o membro a coluna nem existe e o pedido cai no padrão.
     */
    #[Test]
    public function ordem_por_ultimo_acesso_exige_permissao(): void
    {
        $member = $this->json($this->directory(2, ['order' => 'lastSeenAt']));

        $this->assertNotContains('lastSeenAt', $member['meta']['columns']);
        $this->assertNotSame('lastSeenAt', $member['meta']['order']);

        $admin = $this->json($this->directory(1, ['order' => 'lastSeenAt']));

        $this->assertContains('lastSeenAt', $admin['meta']['columns']);
        $this->assertSame('lastSeenAt', $admin['meta']['order']);
    }

    /**
     * Quem esconde que está online (discloseOnline desligado) não tem o
     * "visto por último" mostrado a membros; a moderação ainda vê.
     */
    #[Test]
    public function privacidade_do_ultimo_acesso(): void
    {
        $byMember = [];

        foreach ($this->json($this->directory(2))['included'] as $user) {
            $byMember[$user['attributes']['username']] = $user['attributes'];
        }

        $this->assertArrayNotHasKey('lastSeenAt', $byMember['ana']);
        $this->assertArrayHasKey('lastSeenAt', $byMember['bruno']);

        foreach ($this->json($this->directory(1))['included'] as $user) {
            if ($user['attributes']['username'] === 'ana') {
                $this->assertArrayHasKey('lastSeenAt', $user['attributes']);
            }
        }
    }

    /**
     * O fórum sabe se o ator pode abrir o diretório (para esconder o link).
     */
    #[Test]
    public function forum_informa_se_pode_ver_o_diretorio(): void
    {
        $member = json_decode((string) $this->send($this->request('GET', '/api', ['authenticatedAs' => 2]))->getBody(), true);
        $guest = json_decode((string) $this->send($this->request('GET', '/api'))->getBody(), true);

        $this->assertTrue($member['data']['attributes']['canelaCanViewDirectory']);
        $this->assertFalse($guest['data']['attributes']['canelaCanViewDirectory']);
    }
}
