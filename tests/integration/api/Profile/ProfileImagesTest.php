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

use Flarum\Testing\integration\RetrievesAuthorizedUsers;
use Flarum\Testing\integration\TestCase;
use Flarum\User\User;
use Laminas\Diactoros\Stream;
use Laminas\Diactoros\UploadedFile;
use PHPUnit\Framework\Attributes\Test;
use Psr\Http\Message\ResponseInterface;

/**
 * A capa do perfil e o fundo do cartão (POST/DELETE
 * /api/users/{id}/canela-cover e /canela-card-background, e os atributos
 * canelaCoverUrl/canelaCardBackgroundUrl): quem envia e apaga, a validação do
 * arquivo e da URL e as chaves que desligam envio e campo.
 */
class ProfileImagesTest extends TestCase
{
    use RetrievesAuthorizedUsers;

    /** @var list<string> */
    private array $tmpFiles = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->extension('ramon-canela');

        $this->prepareDatabase([
            User::class => [
                $this->normalUser(),
                ['id' => 3, 'username' => 'vizinho', 'email' => 'vizinho@machine.local', 'is_email_confirmed' => 1, 'canela_cover_url' => 'https://example.com/capa.jpg'],
            ],
        ]);
    }

    protected function tearDown(): void
    {
        foreach ($this->tmpFiles as $file) {
            @unlink($file);
        }

        parent::tearDown();
    }

    private function png(): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'canela-cover').'.png';
        $this->tmpFiles[] = $path;

        $image = imagecreatetruecolor(40, 20);
        imagefill($image, 0, 0, imagecolorallocate($image, 200, 80, 40));
        imagepng($image, $path);
        imagedestroy($image);

        return new UploadedFile(new Stream($path), filesize($path), UPLOAD_ERR_OK, 'capa.png', 'image/png');
    }

    private function textFile(): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'canela-cover').'.png';
        $this->tmpFiles[] = $path;
        file_put_contents($path, '<?php echo "não sou imagem";');

        return new UploadedFile(new Stream($path), filesize($path), UPLOAD_ERR_OK, 'capa.png', 'image/png');
    }

    private function upload(int $userId, ?int $actor, string $route = 'canela-cover', ?UploadedFile $file = null): ResponseInterface
    {
        $request = $this->request('POST', "/api/users/$userId/$route", $actor ? ['authenticatedAs' => $actor] : [])
            // O visitante não tem token CSRF: sem isto o 400 do CSRF esconderia a regra testada.
            ->withAttribute('bypassCsrfToken', true);

        return $this->send($request->withUploadedFiles(['image' => $file ?? $this->png()]));
    }

    private function remove(int $userId, ?int $actor, string $route = 'canela-cover'): ResponseInterface
    {
        return $this->send($this->request('DELETE', "/api/users/$userId/$route", $actor ? ['authenticatedAs' => $actor] : []));
    }

    private function updateUrl(int $userId, int $actor, ?string $url): ResponseInterface
    {
        return $this->send($this->request('PATCH', "/api/users/$userId", [
            'authenticatedAs' => $actor,
            'json' => ['data' => ['type' => 'users', 'id' => (string) $userId, 'attributes' => ['canelaCoverUrl' => $url]]],
        ]));
    }

    /**
     * O dono envia a capa: vira WebP no disco canela-covers e a URL pública
     * volta no usuário.
     */
    #[Test]
    public function dono_envia_a_capa(): void
    {
        $response = $this->upload(2, 2);

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        $stored = User::find(2)->canela_cover_url;
        $this->assertMatchesRegularExpression('/^cover-[A-Za-z0-9]{24}\.webp$/', $stored);

        $url = json_decode((string) $response->getBody(), true)['data']['attributes']['canelaCoverUrl'];
        $this->assertStringEndsWith('/assets/canela-covers/'.$stored, $url);
    }

    /**
     * O fundo do cartão tem rota e coluna próprias.
     */
    #[Test]
    public function dono_envia_o_fundo_do_cartao(): void
    {
        $response = $this->upload(2, 2, 'canela-card-background');

        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertMatchesRegularExpression('/^card-background-.+\.webp$/', User::find(2)->canela_card_bg_url);
        $this->assertNull(User::find(2)->canela_cover_url);
    }

    /**
     * Visitante não envia (401); membro não envia nem apaga a capa de outra
     * pessoa (403).
     */
    #[Test]
    public function so_o_dono_ou_a_moderacao_mexem_na_capa(): void
    {
        $this->assertEquals(401, $this->upload(2, null)->getStatusCode());
        $this->assertEquals(403, $this->upload(3, 2)->getStatusCode());
        $this->assertEquals(403, $this->remove(3, 2)->getStatusCode());

        $this->assertSame('https://example.com/capa.jpg', User::find(3)->canela_cover_url);
    }

    /**
     * Quem edita usuários apaga a capa de qualquer um.
     */
    #[Test]
    public function admin_apaga_capa_alheia(): void
    {
        $this->assertEquals(200, $this->remove(3, 1)->getStatusCode());
        $this->assertNull(User::find(3)->canela_cover_url);
    }

    /**
     * O dono apaga a própria capa; o arquivo enviado sai do disco.
     */
    #[Test]
    public function dono_apaga_a_capa_e_o_arquivo(): void
    {
        $this->upload(2, 2);
        $stored = User::find(2)->canela_cover_url;

        /** @var \Illuminate\Contracts\Filesystem\Factory $disks */
        $disks = $this->app()->getContainer()->make('filesystem');
        $this->assertTrue($disks->disk('canela-covers')->exists($stored));

        $this->assertEquals(200, $this->remove(2, 2)->getStatusCode());
        $this->assertNull(User::find(2)->canela_cover_url);
        $this->assertFalse($disks->disk('canela-covers')->exists($stored));
    }

    /**
     * Sem arquivo, ou com um arquivo que não é imagem, 422.
     */
    #[Test]
    public function arquivo_invalido_e_recusado(): void
    {
        $response = $this->send($this->request('POST', '/api/users/2/canela-cover', ['authenticatedAs' => 2]));
        $this->assertEquals(422, $response->getStatusCode(), (string) $response->getBody());

        $response = $this->upload(2, 2, 'canela-cover', $this->textFile());
        $this->assertEquals(422, $response->getStatusCode(), (string) $response->getBody());

        $this->assertNull(User::find(2)->canela_cover_url);
    }

    /**
     * Envio desligado (canela.profile_cover_upload): a rota de envio some
     * (404), mas a capa por URL continua.
     */
    #[Test]
    public function envio_desligado_mantem_capa_por_url(): void
    {
        $this->setting('canela.profile_cover_upload', false);

        $this->assertEquals(404, $this->upload(2, 2)->getStatusCode());

        $response = $this->updateUrl(2, 2, 'https://example.com/minha.jpg');
        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());
        $this->assertSame('https://example.com/minha.jpg', User::find(2)->canela_cover_url);
    }

    /**
     * Capa desligada (canela.profile_cover): envio e remoção respondem 404,
     * mesmo para quem não teria permissão (a rota não se denuncia).
     */
    #[Test]
    public function capa_desligada_responde_404(): void
    {
        $this->setting('canela.profile_cover', false);

        $this->assertEquals(404, $this->upload(2, 2)->getStatusCode());
        $this->assertEquals(404, $this->remove(3, 2)->getStatusCode());
        $this->assertSame('https://example.com/capa.jpg', User::find(3)->canela_cover_url);
    }

    /**
     * Capa por URL: só https, e nada que quebre o url("…") do CSS.
     */
    #[Test]
    public function url_da_capa_e_validada(): void
    {
        $this->assertEquals(422, $this->updateUrl(2, 2, 'http://example.com/a.jpg')->getStatusCode());
        $this->assertEquals(422, $this->updateUrl(2, 2, 'javascript:alert(1)')->getStatusCode());
        $this->assertEquals(422, $this->updateUrl(2, 2, 'https://example.com/a.jpg");background:url(x')->getStatusCode());

        $this->assertNull(User::find(2)->canela_cover_url);
    }
}
