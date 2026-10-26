<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\System;

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * O usuário do sistema: só o admin o cria (uma vez), ninguém entra com ele
 * (a senha é vetada e qualquer sessão cai) e a API o identifica.
 */
class SystemUserTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    private const PASSWORD_HASH = '$2y$10$LO59tiT7uggl6Oe23o/O6.utnF6ipngYjvMvaxo1TciKqBttDNKim'; // "too-obscure"

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 5, 'username' => 'sistema', 'email' => 'sistema@system.invalid', 'is_email_confirmed' => 1, 'password' => self::PASSWORD_HASH],
            ],
        ]);
    }

    private function json(ResponseInterface $response): array
    {
        return json_decode((string) $response->getBody(), true);
    }

    /**
     * Só o admin cria o usuário do sistema.
     */
    #[Test]
    public function so_o_admin_cria_o_usuario_do_sistema(): void
    {
        $guest = $this->send($this->request('POST', '/api/canela/system-user'));
        $this->assertContains($guest->getStatusCode(), [400, 401]);

        $normal = $this->send($this->request('POST', '/api/canela/system-user', ['authenticatedAs' => 2]));
        $this->assertEquals(403, $normal->getStatusCode());

        $this->assertSame('', (string) $this->database()->table('settings')->where('key', 'canela.system_user_id')->value('value'));
    }

    /**
     * O admin cria a conta (com e-mail num domínio inválido) e a configuração
     * aponta para ela; pedir de novo devolve a mesma conta.
     */
    #[Test]
    public function admin_cria_uma_vez_so(): void
    {
        $first = $this->send($this->request('POST', '/api/canela/system-user', ['authenticatedAs' => 1]));

        $this->assertEquals(200, $first->getStatusCode(), (string) $first->getBody());
        $data = $this->json($first)['data'];
        $this->assertSame('system', $data['username']);

        $user = $this->database()->table('users')->where('id', $data['id'])->first();
        $this->assertStringEndsWith('@system.invalid', $user->email);
        $this->assertSame((string) $data['id'], $this->database()->table('settings')->where('key', 'canela.system_user_id')->value('value'));

        $second = $this->json($this->send($this->request('POST', '/api/canela/system-user', ['authenticatedAs' => 1])))['data'];
        $this->assertSame($data['id'], $second['id']);
        $this->assertSame(1, $this->database()->table('users')->where('email', 'like', '%@system.invalid')->where('username', 'like', 'system%')->count());
    }

    /**
     * O fórum anuncia quem é o usuário do sistema (ou null) e a API marca a
     * conta com `canelaIsSystem`.
     */
    #[Test]
    public function sem_usuario_do_sistema_o_forum_anuncia_null(): void
    {
        $this->assertNull($this->json($this->send($this->request('GET', '/api')))['data']['attributes']['canelaSystemUser']);
        $this->assertFalse($this->json($this->send($this->request('GET', '/api/users/5', ['authenticatedAs' => 2])))['data']['attributes']['canelaIsSystem']);
    }

    /**
     * Com a conta configurada, o fórum a apresenta e a API a marca.
     */
    #[Test]
    public function api_identifica_o_usuario_do_sistema(): void
    {
        $this->setting('canela.system_user_id', '5');

        $forum = $this->json($this->send($this->request('GET', '/api')))['data']['attributes'];
        $this->assertSame(5, $forum['canelaSystemUser']['id']);
        $this->assertSame('sistema', $forum['canelaSystemUser']['username']);

        $this->assertTrue($this->json($this->send($this->request('GET', '/api/users/5', ['authenticatedAs' => 2])))['data']['attributes']['canelaIsSystem']);
        $this->assertFalse($this->json($this->send($this->request('GET', '/api/users/2', ['authenticatedAs' => 2])))['data']['attributes']['canelaIsSystem']);
    }

    /**
     * Ninguém entra com a senha do usuário do sistema, mesmo a certa.
     */
    #[Test]
    public function senha_do_sistema_e_vetada(): void
    {
        $this->setting('canela.system_user_id', '5');

        $response = $this->send($this->request('POST', '/api/token', [
            'json' => ['identification' => 'sistema', 'password' => 'too-obscure'],
        ]));

        $this->assertEquals(401, $response->getStatusCode());

        // A mesma senha funciona para uma conta comum.
        $normal = $this->send($this->request('POST', '/api/token', [
            'json' => ['identification' => 'normal', 'password' => 'too-obscure'],
        ]));
        $this->assertEquals(200, $normal->getStatusCode());
    }

    /**
     * Qualquer token do sistema cai na primeira requisição, que segue como
     * visitante, e ele nunca aparece como "online".
     */
    #[Test]
    public function sessao_do_sistema_cai_na_primeira_requisicao(): void
    {
        $this->setting('canela.system_user_id', '5');

        $response = $this->send($this->request('PATCH', '/api/users/5', [
            'authenticatedAs' => 5,
            'json' => ['data' => ['type' => 'users', 'id' => '5', 'attributes' => ['username' => 'tomado']]],
        ]));

        $this->assertContains($response->getStatusCode(), [401, 403]);
        $this->assertSame('sistema', $this->database()->table('users')->where('id', 5)->value('username'));
        $this->assertSame(0, $this->database()->table('access_tokens')->where('user_id', 5)->count());
        $this->assertNull($this->database()->table('users')->where('id', 5)->value('last_seen_at'));
    }
}
