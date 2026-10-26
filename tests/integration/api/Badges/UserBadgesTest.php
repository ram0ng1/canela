<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Badges;

use Carbon\Carbon;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Badges\Badge;
use Ramon\Canela\Badges\UserBadge;

/**
 * Concessões (`/api/canela-user-badges`): a lista dos emblemas de alguém, a
 * concessão manual e a revogação pelo admin, e o nível de confiança no usuário.
 */
class UserBadgesTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'outro', 'email' => 'outro@machine.local', 'is_email_confirmed' => 1],
            ],
            'canela_badges' => [
                BadgesTest::badge(100, 'Pioneiro'),
                BadgesTest::badge(101, 'Desligado', ['enabled' => false]),
                BadgesTest::badge(102, 'Repetível', ['multiple_grant' => true]),
                BadgesTest::badge(103, 'Automático manual-off', ['manual_grant' => false]),
            ],
            'canela_user_badges' => [
                ['id' => 1, 'user_id' => 2, 'badge_id' => 100, 'granted_at' => Carbon::now()->subDays(2), 'reason' => 'Fundador'],
                ['id' => 2, 'user_id' => 2, 'badge_id' => 101, 'granted_at' => Carbon::now()->subDay()],
                ['id' => 3, 'user_id' => 3, 'badge_id' => 100, 'granted_at' => Carbon::now()],
            ],
        ]);
    }

    private function body($response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    private function grant(int $actor, array $body)
    {
        return $this->send($this->request('POST', '/api/canela-user-badges/grant', [
            'authenticatedAs' => $actor,
            'json' => $body,
        ]));
    }

    /** `filter[user]` lista os emblemas da pessoa, sem os desligados, com o emblema incluído. */
    #[Test]
    public function lista_emblemas_do_usuario(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-user-badges')
            ->withQueryParams(['filter' => ['user' => '2']]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $body = $this->body($response);

        $this->assertEquals(['1'], array_column($body['data'], 'id'));
        $this->assertEquals('Fundador', $body['data'][0]['attributes']['reason']);
        $this->assertContains('canela-badges', array_column($body['included'], 'type'));
    }

    /** O filtro aceita o nome de usuário, como numa URL escrita à mão. */
    #[Test]
    public function filtro_por_nome_de_usuario(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-user-badges', ['authenticatedAs' => 2])
            ->withQueryParams(['filter' => ['user' => 'outro']]));

        $this->assertEquals(['3'], array_column($this->body($response)['data'], 'id'));
    }

    /** `filter[badge]` lista quem ganhou um emblema, o mais recente primeiro. */
    #[Test]
    public function lista_quem_ganhou_o_emblema(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-user-badges')
            ->withQueryParams(['filter' => ['badge' => '100']]));

        $this->assertEquals(['3', '1'], array_column($this->body($response)['data'], 'id'));
    }

    /** O admin vê também as concessões de emblemas desligados. */
    #[Test]
    public function admin_ve_concessoes_de_emblema_desligado(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-user-badges', ['authenticatedAs' => 1])
            ->withQueryParams(['filter' => ['user' => '2']]));

        $ids = array_column($this->body($response)['data'], 'id');
        sort($ids);

        $this->assertEquals(['1', '2'], $ids);

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-user-badges/2', ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(200, $this->send($this->request('GET', '/api/canela-user-badges/2', ['authenticatedAs' => 1]))->getStatusCode());
    }

    /** Desligado no admin, a lista de concessões some (404) para os demais. */
    #[Test]
    public function recurso_desligado_responde_404(): void
    {
        $this->setting('canela.badges_enabled', '0');

        $response = $this->send($this->request('GET', '/api/canela-user-badges', ['authenticatedAs' => 2])
            ->withQueryParams(['filter' => ['user' => '2']]));

        $this->assertEquals(404, $response->getStatusCode());
    }

    /** O admin concede à mão: grava o motivo e quem concedeu, e notifica a pessoa. */
    #[Test]
    public function admin_concede_emblema(): void
    {
        $response = $this->grant(1, ['badgeId' => 102, 'username' => 'outro', 'reason' => 'https://exemplo.com/post/1']);

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        $id = (int) $this->body($response)['meta']['id'];
        $grant = UserBadge::query()->find($id);

        $this->assertEquals(3, $grant->user_id);
        $this->assertEquals(102, $grant->badge_id);
        $this->assertEquals(1, $grant->granted_by_id);
        $this->assertEquals('https://exemplo.com/post/1', $grant->reason);

        $this->assertTrue(
            $this->database()->table('notifications')->where('user_id', 3)->where('subject_id', 102)->exists(),
            'a pessoa recebe o "Ganhou …"'
        );
    }

    /** Usuário comum não concede nem revoga (403). */
    #[Test]
    public function usuario_nao_concede_nem_revoga(): void
    {
        $grant = $this->grant(2, ['badgeId' => 102, 'username' => 'normal']);
        $revoke = $this->send($this->request('DELETE', '/api/canela-user-badges/3', ['authenticatedAs' => 2]));

        $this->assertEquals(403, $grant->getStatusCode());
        $this->assertEquals(403, $revoke->getStatusCode());
        $this->assertEquals(0, UserBadge::query()->where('badge_id', 102)->count());
        $this->assertNotNull(UserBadge::query()->find(3));
    }

    /**
     * A concessão manual valida tudo antes de gravar: emblema que existe e
     * aceita concessão manual, pessoa que existe, emblema único que ela ainda
     * não tem e motivo que, se for endereço, é http(s).
     */
    #[Test]
    public function validacao_da_concessao_manual(): void
    {
        $this->app();
        $system = Badge::query()->where('slug', 'editor')->firstOrFail();

        $this->assertEquals(422, $this->grant(1, ['badgeId' => 9999, 'username' => 'normal'])->getStatusCode(), 'emblema inexistente');
        $this->assertEquals(422, $this->grant(1, ['badgeId' => $system->id, 'username' => 'normal'])->getStatusCode(), 'emblema do sistema');
        $this->assertEquals(422, $this->grant(1, ['badgeId' => 103, 'username' => 'normal'])->getStatusCode(), 'concessão manual desligada');
        $this->assertEquals(422, $this->grant(1, ['badgeId' => 102, 'username' => 'ninguem'])->getStatusCode(), 'usuário inexistente');
        $this->assertEquals(422, $this->grant(1, ['badgeId' => 100, 'username' => 'normal'])->getStatusCode(), 'já tem o emblema único');
        $this->assertEquals(422, $this->grant(1, ['badgeId' => 102, 'username' => 'normal', 'reason' => 'ftp://exemplo.com'])->getStatusCode(), 'motivo com esquema não-http');
        $this->assertEquals(422, $this->grant(1, ['badgeId' => 102, 'username' => 'normal', 'reason' => str_repeat('a', 501)])->getStatusCode(), 'motivo longo demais');

        $this->assertEquals(0, UserBadge::query()->where('badge_id', 102)->count());
    }

    /** Emblema de concessão múltipla pode ser dado de novo à mesma pessoa. */
    #[Test]
    public function emblema_multiplo_concede_de_novo(): void
    {
        $this->assertEquals(201, $this->grant(1, ['badgeId' => 102, 'username' => 'normal'])->getStatusCode());
        $this->assertEquals(201, $this->grant(1, ['badgeId' => 102, 'username' => 'normal'])->getStatusCode());

        $this->assertEquals(2, UserBadge::query()->where('badge_id', 102)->where('user_id', 2)->count());
    }

    /** O admin revoga uma concessão. */
    #[Test]
    public function admin_revoga_concessao(): void
    {
        $response = $this->send($this->request('DELETE', '/api/canela-user-badges/3', ['authenticatedAs' => 1]));

        $this->assertEquals(204, $response->getStatusCode());
        $this->assertNull(UserBadge::query()->find(3));
    }

    /** `trustLevel` é público; `trustLevelLocked` só o admin vê. */
    #[Test]
    public function nivel_de_confianca_no_usuario(): void
    {
        $user = $this->body($this->send($this->request('GET', '/api/users/3', ['authenticatedAs' => 2])))['data']['attributes'];
        $admin = $this->body($this->send($this->request('GET', '/api/users/3', ['authenticatedAs' => 1])))['data']['attributes'];

        $this->assertSame(0, $user['trustLevel']);
        $this->assertArrayNotHasKey('trustLevelLocked', $user);
        $this->assertArrayHasKey('trustLevelLocked', $admin);
    }

    /** O admin escolhe o nível à mão, e o nível fica fixado. */
    #[Test]
    public function admin_define_nivel_e_fixa(): void
    {
        $response = $this->send($this->request('PATCH', '/api/users/3', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'users', 'id' => '3', 'attributes' => ['trustLevel' => 4]]],
        ]));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $attributes = $this->body($response)['data']['attributes'];

        $this->assertSame(4, $attributes['trustLevel']);
        $this->assertTrue($attributes['trustLevelLocked']);
    }

    /** Nível fora de 0–4: 422. */
    #[Test]
    public function nivel_fora_do_intervalo_e_invalido(): void
    {
        $response = $this->send($this->request('PATCH', '/api/users/3', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'users', 'id' => '3', 'attributes' => ['trustLevel' => 5]]],
        ]));

        $this->assertEquals(422, $response->getStatusCode());
    }

    /** O próprio usuário não sobe o próprio nível. */
    #[Test]
    public function usuario_nao_muda_o_proprio_nivel(): void
    {
        $response = $this->send($this->request('PATCH', '/api/users/2', [
            'authenticatedAs' => 2,
            'json' => ['data' => ['type' => 'users', 'id' => '2', 'attributes' => ['trustLevel' => 4]]],
        ]));

        $this->assertEquals(403, $response->getStatusCode());
        $this->assertEquals(0, (int) User::query()->find(2)->getAttribute('canela_trust_level'));
    }
}
