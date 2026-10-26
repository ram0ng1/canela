<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Gaps;

use Carbon\Carbon;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * Os links de convite (/api/canela-invites, /api/canela-invite-info e
 * /invites/{código}): quem pode gerar, os limites de uso e validade, o
 * dono de cada convite e o resgate no cadastro.
 */
class InvitesTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    private const CODE_OF_USER_3 = 'AbCdEfGhIjKlMnOpQrStUvWxYz012345';

    private const EXPIRED_CODE = 'ExpiredExpiredExpiredExpired0001';

    private const FULL_CODE = 'FullFullFullFullFullFullFull0001';

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->setting('mail_driver', 'log');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'convidante', 'email' => 'convidante@machine.local', 'is_email_confirmed' => 1],
            ],
            'canela_invites' => [
                ['id' => 1, 'code' => self::CODE_OF_USER_3, 'user_id' => 3, 'max_redemptions' => 5, 'redemption_count' => 0, 'expires_at' => Carbon::now()->addDays(3), 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
                ['id' => 2, 'code' => self::EXPIRED_CODE, 'user_id' => 3, 'max_redemptions' => 5, 'redemption_count' => 0, 'expires_at' => Carbon::now()->subDay(), 'created_at' => Carbon::now()->subDays(8), 'updated_at' => Carbon::now()->subDays(8)],
                ['id' => 3, 'code' => self::FULL_CODE, 'user_id' => 3, 'max_redemptions' => 1, 'redemption_count' => 1, 'expires_at' => Carbon::now()->addDays(3), 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
            ],
        ]);
    }

    private function json(ResponseInterface $response): array
    {
        return json_decode((string) $response->getBody(), true) ?? [];
    }

    private function createInvite(int $actor, array $body = []): ResponseInterface
    {
        return $this->send($this->request('POST', '/api/canela-invites', [
            'authenticatedAs' => $actor,
            'json' => $body,
        ]));
    }

    /**
     * Visitante não tem convites: a lista exige conta.
     */
    #[Test]
    public function visitante_nao_lista_convites(): void
    {
        $response = $this->send($this->request('GET', '/api/canela-invites'));

        $this->assertEquals(401, $response->getStatusCode());
    }

    /**
     * Membro (permissão canela.createInvite, dada aos Membros pela migration)
     * gera um link: código de 32 caracteres, URL /invites/{código}, válido.
     */
    #[Test]
    public function membro_gera_convite(): void
    {
        $response = $this->createInvite(2, ['maxRedemptions' => 3, 'expiresDays' => 2]);

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        $invite = $this->json($response)['invite'];

        $this->assertMatchesRegularExpression('/^[A-Za-z0-9]{32}$/', $invite['code']);
        $this->assertStringEndsWith('/invites/'.$invite['code'], $invite['url']);
        $this->assertSame(3, $invite['maxRedemptions']);
        $this->assertSame(0, $invite['redemptionCount']);
        $this->assertTrue($invite['usable']);

        $this->assertEquals(1, $this->database()->table('canela_invites')->where('user_id', 2)->count());
    }

    /**
     * Usos e validade fora da faixa são presos aos limites (1–100 usos,
     * 1–90 dias), em vez de gravados como vieram.
     */
    #[Test]
    public function limites_de_usos_e_validade_sao_respeitados(): void
    {
        $response = $this->createInvite(2, ['maxRedemptions' => 5000, 'expiresDays' => 1000]);

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        $invite = $this->json($response)['invite'];

        $this->assertSame(100, $invite['maxRedemptions']);

        $days = Carbon::now()->diffInDays(Carbon::parse($invite['expiresAt']));
        $this->assertEqualsWithDelta(90, $days, 1);

        $invite = $this->json($this->createInvite(2, ['maxRedemptions' => -4, 'expiresDays' => 0]))['invite'];

        $this->assertSame(1, $invite['maxRedemptions']);
        $this->assertEqualsWithDelta(1, Carbon::now()->diffInDays(Carbon::parse($invite['expiresAt'])), 1);
    }

    /**
     * Ninguém tem mais que 20 convites ativos: o 21º é recusado com 422.
     */
    #[Test]
    public function no_maximo_vinte_convites_ativos(): void
    {
        $rows = [];

        for ($i = 0; $i < 20; $i++) {
            $rows[] = ['code' => sprintf('Active%026d', $i), 'user_id' => 2, 'max_redemptions' => 1, 'redemption_count' => 0, 'expires_at' => Carbon::now()->addDay(), 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()];
        }

        $this->database()->table('canela_invites')->insert($rows);

        $response = $this->createInvite(2);

        $this->assertEquals(422, $response->getStatusCode(), (string) $response->getBody());
        $this->assertEquals(20, $this->database()->table('canela_invites')->where('user_id', 2)->count());
    }

    /**
     * Sem a permissão canela.createInvite, gerar dá 403 — mas listar e apagar
     * os próprios convites continua: quem perdeu a permissão precisa poder
     * revogar os links que já espalhou.
     */
    #[Test]
    public function sem_permissao_nao_gera_convite(): void
    {
        $this->database()->table('group_permission')->where('permission', 'canela.createInvite')->delete();

        $this->assertEquals(403, $this->createInvite(2)->getStatusCode());
        $this->assertEquals(0, $this->database()->table('canela_invites')->where('user_id', 2)->count());

        $list = $this->send($this->request('GET', '/api/canela-invites', ['authenticatedAs' => 3]));
        $this->assertEquals(200, $list->getStatusCode(), (string) $list->getBody());
        $this->assertCount(3, $this->json($list)['invites']);
        $this->assertFalse($this->json($list)['canCreate']);

        $this->assertEquals(204, $this->send($this->request('DELETE', '/api/canela-invites/1', ['authenticatedAs' => 3]))->getStatusCode());
        $this->assertFalse($this->database()->table('canela_invites')->where('id', 1)->exists());
    }

    /**
     * O convite vale enquanto quem convidou puder convidar: sem a permissão,
     * o link aparece como inválido e o cadastro com ele não conta.
     */
    #[Test]
    public function convite_de_quem_perdeu_a_permissao_nao_vale(): void
    {
        $this->database()->table('group_permission')->where('permission', 'canela.createInvite')->delete();

        $info = $this->json($this->send($this->request('GET', '/api/canela-invite-info/'.self::CODE_OF_USER_3)));
        $this->assertFalse($info['valid']);

        $this->assertEquals(201, $this->register('semvaga', self::CODE_OF_USER_3)->getStatusCode());
        $this->assertEquals(0, $this->database()->table('canela_invites')->where('id', 1)->value('redemption_count'));
    }

    /**
     * Com o recurso desligado no admin, as rotas respondem 404 (até para o admin).
     */
    #[Test]
    public function recurso_desligado_responde_404(): void
    {
        $this->setting('canela.invites_enabled', false);

        $this->assertEquals(404, $this->createInvite(1)->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-invites', ['authenticatedAs' => 2]))->getStatusCode());
        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela-invite-info/'.self::CODE_OF_USER_3))->getStatusCode());
    }

    /**
     * A lista traz só os convites de quem pede.
     */
    #[Test]
    public function lista_so_os_proprios_convites(): void
    {
        $this->createInvite(2);

        $mine = $this->json($this->send($this->request('GET', '/api/canela-invites', ['authenticatedAs' => 2])))['invites'];
        $theirs = $this->json($this->send($this->request('GET', '/api/canela-invites', ['authenticatedAs' => 3])))['invites'];

        $this->assertCount(1, $mine);
        $this->assertCount(3, $theirs);
        $this->assertNotContains(self::CODE_OF_USER_3, array_column($mine, 'code'));
    }

    /**
     * Apagar o convite de outra pessoa responde como inexistente (404) e não
     * apaga nada; o próprio sai com 204.
     */
    #[Test]
    public function so_o_dono_apaga_o_convite(): void
    {
        $response = $this->send($this->request('DELETE', '/api/canela-invites/1', ['authenticatedAs' => 2]));

        $this->assertEquals(404, $response->getStatusCode());
        $this->assertTrue($this->database()->table('canela_invites')->where('id', 1)->exists());

        $response = $this->send($this->request('DELETE', '/api/canela-invites/1', ['authenticatedAs' => 3]));

        $this->assertEquals(204, $response->getStatusCode());
        $this->assertFalse($this->database()->table('canela_invites')->where('id', 1)->exists());
    }

    /**
     * A informação pública do convite: válido com o nome de quem convidou;
     * vencido, esgotado ou inventado aparece como inválido, sem o nome.
     */
    #[Test]
    public function informacao_publica_do_convite(): void
    {
        $valid = $this->json($this->send($this->request('GET', '/api/canela-invite-info/'.self::CODE_OF_USER_3)));

        $this->assertTrue($valid['valid']);
        $this->assertSame('convidante', $valid['inviter']);

        foreach ([self::EXPIRED_CODE, self::FULL_CODE, 'NaoExisteNaoExisteNaoExiste00001'] as $code) {
            $info = $this->json($this->send($this->request('GET', '/api/canela-invite-info/'.$code)));

            $this->assertFalse($info['valid'], $code);
            $this->assertNull($info['inviter'], $code);
        }
    }

    /**
     * O link /invites/{código} leva à página inicial com o código; um código
     * esgotado leva só à página inicial.
     */
    #[Test]
    public function link_do_convite_redireciona(): void
    {
        $response = $this->send($this->request('GET', '/invites/'.self::CODE_OF_USER_3));

        $this->assertEquals(302, $response->getStatusCode());
        $this->assertStringContainsString('canelaInvite='.self::CODE_OF_USER_3, $response->getHeaderLine('Location'));

        $response = $this->send($this->request('GET', '/invites/'.self::FULL_CODE));

        $this->assertEquals(302, $response->getStatusCode());
        $this->assertStringNotContainsString('canelaInvite', $response->getHeaderLine('Location'));
    }

    private function register(string $username, string $code): ResponseInterface
    {
        return $this->send(
            $this->request('POST', '/api/users', [
                'json' => ['data' => ['type' => 'users', 'attributes' => [
                    'username' => $username,
                    'password' => 'too-obscure',
                    'email' => "$username@machine.local",
                    'canelaInviteCode' => $code,
                ]]],
            ])->withAttribute('bypassCsrfToken', true)
        );
    }

    private function inviteAccepted(int $from): bool
    {
        return $this->database()->table('notifications')
            ->where('user_id', 3)
            ->where('type', 'canelaInviteAccepted')
            ->where('from_user_id', $from)
            ->exists();
    }

    /**
     * Um cadastro com o código conta um uso e guarda o resgate na hora. O
     * aviso a quem convidou ("aceitou seu convite") espera o e-mail ser
     * confirmado: antes disso a conta pode nunca valer.
     */
    #[Test]
    public function cadastro_com_codigo_resgata_o_convite(): void
    {
        $response = $this->register('novato', self::CODE_OF_USER_3);

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        $newUser = User::query()->where('username', 'novato')->firstOrFail();

        $this->assertEquals(1, $this->database()->table('canela_invites')->where('id', 1)->value('redemption_count'));
        $this->assertTrue($this->database()->table('canela_invite_redemptions')->where('user_id', $newUser->id)->where('invite_id', 1)->exists());
        $this->assertFalse($this->inviteAccepted((int) $newUser->id));

        $token = $this->database()->table('email_tokens')->where('user_id', $newUser->id)->value('token');
        $this->assertNotNull($token);

        $confirm = $this->send($this->request('POST', "/confirm/$token")->withAttribute('bypassCsrfToken', true));
        $this->assertContains($confirm->getStatusCode(), [200, 302], (string) $confirm->getBody());

        $this->assertTrue($this->inviteAccepted((int) $newUser->id));
    }

    /**
     * Cadastro que já chega confirmado (o admin cria a conta): o aviso sai
     * no próprio cadastro.
     */
    #[Test]
    public function cadastro_ja_confirmado_avisa_na_hora(): void
    {
        $response = $this->send($this->request('POST', '/api/users', [
            'authenticatedAs' => 1,
            'json' => ['data' => ['type' => 'users', 'attributes' => [
                'username' => 'confirmado',
                'password' => 'too-obscure',
                'email' => 'confirmado@machine.local',
                'isEmailConfirmed' => true,
                'canelaInviteCode' => self::CODE_OF_USER_3,
            ]]],
        ]));

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());

        $newUser = User::query()->where('username', 'confirmado')->firstOrFail();

        $this->assertTrue((bool) $newUser->is_email_confirmed);
        $this->assertTrue($this->inviteAccepted((int) $newUser->id));
    }

    /**
     * Um código esgotado não impede o cadastro: só não conta.
     */
    #[Test]
    public function cadastro_com_codigo_esgotado_nao_conta(): void
    {
        $response = $this->send(
            $this->request('POST', '/api/users', [
                'json' => ['data' => ['type' => 'users', 'attributes' => [
                    'username' => 'atrasado',
                    'password' => 'too-obscure',
                    'email' => 'atrasado@machine.local',
                    'canelaInviteCode' => self::FULL_CODE,
                ]]],
            ])->withAttribute('bypassCsrfToken', true)
        );

        $this->assertEquals(201, $response->getStatusCode(), (string) $response->getBody());
        $this->assertEquals(1, $this->database()->table('canela_invites')->where('id', 3)->value('redemption_count'));
        $this->assertEquals(0, $this->database()->table('canela_invite_redemptions')->count());
        $this->assertFalse($this->database()->table('notifications')->where('type', 'canelaInviteAccepted')->exists());
    }

    /**
     * O fórum sabe se quem está vendo pode convidar: membro sim, visitante não.
     */
    #[Test]
    public function forum_informa_quem_pode_convidar(): void
    {
        $member = $this->json($this->send($this->request('GET', '/api', ['authenticatedAs' => 2])))['data']['attributes'];
        $guest = $this->json($this->send($this->request('GET', '/api')))['data']['attributes'];

        $this->assertTrue($member['canelaCanInvite']);
        $this->assertFalse($guest['canelaCanInvite']);
        $this->assertTrue($guest['canelaInvitesEnabled']);
        $this->assertFalse($member['canelaHasInvites']);
        $this->assertFalse($guest['canelaHasInvites']);
    }

    /**
     * Sem a permissão, quem tem convites ainda fica sabendo (para abrir a
     * janela e revogá-los).
     */
    #[Test]
    public function forum_informa_quem_tem_convites_para_revogar(): void
    {
        $this->database()->table('group_permission')->where('permission', 'canela.createInvite')->delete();

        $owner = $this->json($this->send($this->request('GET', '/api', ['authenticatedAs' => 3])))['data']['attributes'];

        $this->assertFalse($owner['canelaCanInvite']);
        $this->assertTrue($owner['canelaHasInvites']);
    }

    /**
     * Quem convidou foi suspenso: os convites dele param de valer.
     */
    #[Test]
    public function convite_de_suspenso_nao_vale(): void
    {
        $this->extension('flarum-suspend');
        $this->prepareDatabase([
            User::class => [
                ['id' => 4, 'username' => 'suspensa', 'email' => 'suspensa@machine.local', 'is_email_confirmed' => 1, 'suspended_until' => Carbon::now()->addDay()],
            ],
            'canela_invites' => [
                ['id' => 4, 'code' => 'SuspSuspSuspSuspSuspSuspSusp0001', 'user_id' => 4, 'max_redemptions' => 5, 'redemption_count' => 0, 'expires_at' => Carbon::now()->addDays(3), 'created_at' => Carbon::now(), 'updated_at' => Carbon::now()],
            ],
        ]);

        $this->assertFalse($this->json($this->send($this->request('GET', '/api/canela-invite-info/SuspSuspSuspSuspSuspSuspSusp0001')))['valid']);
        $this->assertTrue($this->json($this->send($this->request('GET', '/api/canela-invite-info/'.self::CODE_OF_USER_3)))['valid']);
    }
}
