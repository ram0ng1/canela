<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Profile;

use Carbon\Carbon;
use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * Os campos do perfil estendido no /api/users: bio (limite, normalização e
 * HTML seguro), site, título, aniversário — quem escreve, quem lê o quê e as
 * chaves que desligam cada campo.
 */
class ProfileFieldsTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser() + ['canela_birthday' => '1990-05-17'],
                ['id' => 3, 'username' => 'vizinho', 'email' => 'vizinho@machine.local', 'is_email_confirmed' => 1, 'canela_bio' => 'bio do vizinho'],
            ],
        ]);
    }

    private function update(int $userId, int $actor, array $attributes): ResponseInterface
    {
        return $this->send($this->request('PATCH', "/api/users/$userId", [
            'authenticatedAs' => $actor,
            'json' => ['data' => ['type' => 'users', 'id' => (string) $userId, 'attributes' => $attributes]],
        ]));
    }

    private function show(int $userId, ?int $actor): array
    {
        $response = $this->send($this->request('GET', "/api/users/$userId", $actor ? ['authenticatedAs' => $actor] : []));

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return json_decode((string) $response->getBody(), true)['data']['attributes'];
    }

    /**
     * O dono grava a bio; ela é normalizada (CRLF, controles, linhas em branco
     * a mais) e vira HTML com parágrafos, quebras e ênfase.
     */
    #[Test]
    public function dono_grava_a_bio(): void
    {
        $response = $this->update(2, 2, ['canelaBio' => "  Olá **mundo**\r\n\r\n\r\n\r\nsegunda\u{202E} linha  "]);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $this->assertSame("Olá **mundo**\n\nsegunda linha", User::find(2)->canela_bio);

        $attributes = json_decode((string) $response->getBody(), true)['data']['attributes'];
        $this->assertSame('<p>Olá <strong>mundo</strong></p><p>segunda linha</p>', $attributes['canelaBioHtml']);
    }

    /**
     * A bio não vira brecha de HTML: tags são escapadas, só links http(s)
     * viram <a> (com rel="ugc nofollow"), e javascript: fica como texto.
     */
    #[Test]
    public function bio_renderiza_html_seguro(): void
    {
        $this->update(2, 2, ['canelaBio' => '<script>alert(1)</script> veja https://example.com/x. e javascript:alert(1)']);

        $html = $this->show(2, null)['canelaBioHtml'];

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
        $this->assertStringContainsString('<a href="https://example.com/x" rel="ugc nofollow noopener" target="_blank">example.com/x</a>.', $html);
        $this->assertStringNotContainsString('href="javascript', $html);
    }

    /**
     * Bio acima do limite padrão (1000) é recusada com 422.
     */
    #[Test]
    public function bio_longa_demais_e_recusada(): void
    {
        $response = $this->update(2, 2, ['canelaBio' => str_repeat('a', 1001)]);

        $this->assertEquals(422, $response->getStatusCode(), (string) $response->getBody());
        $this->assertNull(User::find(2)->canela_bio);
    }

    /**
     * O limite vem do admin (canela.profile_bio_max_length).
     */
    #[Test]
    public function limite_da_bio_configuravel(): void
    {
        $this->setting('canela.profile_bio_max_length', 10);

        $this->assertEquals(422, $this->update(2, 2, ['canelaBio' => str_repeat('a', 11)])->getStatusCode());
        $this->assertEquals(200, $this->update(2, 2, ['canelaBio' => str_repeat('a', 10)])->getStatusCode());
    }

    /**
     * Um membro não edita o perfil de outra pessoa.
     */
    #[Test]
    public function membro_nao_edita_perfil_alheio(): void
    {
        $response = $this->update(3, 2, ['canelaBio' => 'invadido']);

        $this->assertEquals(403, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame('bio do vizinho', User::find(3)->canela_bio);
    }

    /**
     * Quem edita usuários (o admin) edita o perfil de qualquer um.
     */
    #[Test]
    public function admin_edita_perfil_alheio(): void
    {
        $response = $this->update(3, 1, ['canelaBio' => 'moderada']);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame('moderada', User::find(3)->canela_bio);
    }

    /**
     * O texto cru da bio só vai para o dono e quem edita; os outros recebem
     * só o HTML.
     */
    #[Test]
    public function texto_cru_da_bio_so_para_o_dono(): void
    {
        $this->assertArrayNotHasKey('canelaBio', $this->show(3, 2));
        $this->assertSame('<p>bio do vizinho</p>', $this->show(3, 2)['canelaBioHtml']);
        $this->assertSame('bio do vizinho', $this->show(3, 3)['canelaBio']);
        $this->assertSame('bio do vizinho', $this->show(3, 1)['canelaBio']);
        $this->assertFalse($this->show(3, 2)['canelaCanEditProfile']);
        $this->assertTrue($this->show(3, 3)['canelaCanEditProfile']);
    }

    /**
     * Site só http(s): javascript: e afins dão 422.
     */
    #[Test]
    public function site_invalido_e_recusado(): void
    {
        $this->assertEquals(422, $this->update(2, 2, ['canelaWebsite' => 'javascript:alert(1)'])->getStatusCode());
        $this->assertEquals(422, $this->update(2, 2, ['canelaWebsite' => 'ftp://example.com'])->getStatusCode());
        $this->assertEquals(200, $this->update(2, 2, ['canelaWebsite' => 'https://example.com'])->getStatusCode());
        $this->assertSame('https://example.com', User::find(2)->canela_website);
    }

    /**
     * Com a chave-mestra desligada, os campos somem da API e não se gravam.
     */
    #[Test]
    public function perfil_desligado_esconde_os_campos(): void
    {
        $this->setting('canela.profile_enabled', false);

        $attributes = $this->show(3, 3);

        $this->assertArrayNotHasKey('canelaBioHtml', $attributes);
        $this->assertArrayNotHasKey('canelaCanEditProfile', $attributes);

        $this->update(3, 3, ['canelaBio' => 'não deveria gravar']);
        $this->assertSame('bio do vizinho', User::find(3)->canela_bio);
    }

    /**
     * Só a bio desligada (canela.profile_bio): a bio some e o site continua.
     */
    #[Test]
    public function campo_desligado_individualmente(): void
    {
        $this->setting('canela.profile_bio', false);

        $attributes = $this->show(3, 3);

        $this->assertArrayNotHasKey('canelaBioHtml', $attributes);
        $this->assertArrayHasKey('canelaWebsite', $attributes);
    }

    /**
     * Com o título fora da escolha do usuário, só a moderação o define.
     */
    #[Test]
    public function titulo_so_pela_moderacao_quando_configurado(): void
    {
        $this->setting('canela.profile_title_self', false);

        $response = $this->update(2, 2, ['canelaTitle' => 'Rainha']);
        $this->assertEquals(403, $response->getStatusCode(), (string) $response->getBody());
        $this->assertNull(User::find(2)->canela_title);

        $this->assertEquals(200, $this->update(2, 1, ['canelaTitle' => 'Veterana'])->getStatusCode());
        $this->assertSame('Veterana', User::find(2)->canela_title);
    }

    /**
     * Aniversário: os outros veem só dia e mês; o dono vê a data completa.
     * Com "mostrar o ano" ligado, o ano aparece para todos.
     */
    #[Test]
    public function privacidade_do_aniversario(): void
    {
        $other = $this->show(2, 3);

        $this->assertSame('05-17', $other['canelaBirthday']);
        $this->assertArrayNotHasKey('canelaBirthdayDate', $other);

        $this->assertSame('1990-05-17', $this->show(2, 2)['canelaBirthdayDate']);

        $this->assertEquals(200, $this->update(2, 2, ['canelaBirthdayShowYear' => true])->getStatusCode());
        $this->assertSame('1990-05-17', $this->show(2, 3)['canelaBirthday']);
    }

    /**
     * Aniversário no futuro é recusado.
     */
    #[Test]
    public function aniversario_no_futuro_e_recusado(): void
    {
        $response = $this->update(2, 2, ['canelaBirthdayDate' => Carbon::now()->addYear()->toDateString()]);

        $this->assertEquals(422, $response->getStatusCode(), (string) $response->getBody());
    }

    /**
     * Um usuário suspenso não edita o próprio perfil.
     */
    #[Test]
    public function suspenso_nao_edita_o_proprio_perfil(): void
    {
        $this->extension('flarum-suspend');

        $this->database()->table('users')->where('id', 3)->update(['suspended_until' => Carbon::now()->addDay()]);

        $this->assertEquals(403, $this->update(3, 3, ['canelaBio' => 'falando mesmo suspenso'])->getStatusCode());

        $this->assertSame('bio do vizinho', User::find(3)->canela_bio);
    }
}
