<?php

declare(strict_types=1);

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

namespace Ramon\Canela\Tests\integration\api\Onebox;

use Flarum\Extend;
use Flarum\Testing\integration\TestCase;
use PHPUnit\Framework\Attributes\Test;
use Ramon\Canela\Onebox\OneboxSettings;

/**
 * `GET /api/canela/onebox`: o cartão de um link do GitHub, buscado no
 * GitHub falso (FakeGithubHttp), em cache, só de repositório público e sem
 * o token no raw; `data: null` para o que não vira cartão.
 */
class OneboxTest extends TestCase
{
    private const REPO = 'https://api.github.com/repos/discourse/discourse';

    protected function setUp(): void
    {
        parent::setUp();

        FakeGithubHttp::$responses = [];
        FakeGithubHttp::$requests = [];

        $this->extension('ramon-canela');
        $this->extend((new Extend\ServiceProvider())->register(FakeGithubServiceProvider::class));
    }

    private function onebox(string $url): ?array
    {
        $response = $this->send($this->request('GET', '/api/canela/onebox')->withQueryParams(['url' => $url]));
        $this->assertEquals(200, $response->getStatusCode(), (string) $response->getBody());

        return json_decode((string) $response->getBody(), true)['data'];
    }

    private static function repo(bool $private = false): array
    {
        return ['status' => 200, 'body' => json_encode(['full_name' => 'discourse/discourse', 'private' => $private, 'description' => "Uma\nplataforma", 'stargazers_count' => 44000, 'forks_count' => 8000, 'language' => 'Ruby', 'pushed_at' => '2026-10-30T10:00:00Z'])];
    }

    #[Test]
    public function arquivo_com_as_linhas_pedidas(): void
    {
        $lines = [];
        for ($n = 1; $n <= 700; $n++) {
            $lines[] = "linha $n";
        }
        FakeGithubHttp::$responses['https://raw.githubusercontent.com/discourse/discourse/5e9779d4c/config/locales/client.en.yml'] = ['status' => 200, 'body' => implode("\n", $lines)."\n"];

        $card = $this->onebox('https://github.com/discourse/discourse/blob/5e9779d4c/config/locales/client.en.yml#L597-L609');

        $this->assertSame('file', $card['type']);
        $this->assertSame('discourse/discourse', $card['repo']);
        $this->assertSame('config/locales/client.en.yml', $card['path']);
        $this->assertSame('5e9779d4c', $card['ref']);
        $this->assertSame('yml', $card['extension']);
        $this->assertSame(597, $card['firstLine']);
        $this->assertCount(13, $card['lines']);
        $this->assertSame('linha 597', $card['lines'][0]);
        $this->assertNull($card['highlight']);
        $this->assertSame(700, $card['totalLines']);
        // O raw não leva o token.
        $this->assertArrayNotHasKey('Authorization', FakeGithubHttp::$requests[0]['headers']);

        // A segunda vez vem do cache: nenhum pedido novo ao GitHub.
        $this->onebox('https://github.com/discourse/discourse/blob/5e9779d4c/config/locales/client.en.yml#L597-L609');
        $this->assertCount(1, FakeGithubHttp::$requests);
    }

    #[Test]
    public function pull_request_e_issue(): void
    {
        $this->setting(OneboxSettings::GITHUB_TOKEN, 'token-secreto');
        FakeGithubHttp::$responses[self::REPO] = self::repo();
        FakeGithubHttp::$responses[self::REPO.'/pulls/123'] = ['status' => 200, 'body' => json_encode([
            'number' => 123, 'title' => 'Corrige o onebox', 'state' => 'closed', 'merged_at' => '2026-10-01T00:00:00Z', 'user' => ['login' => 'ramon'],
            'created_at' => '2026-09-30T12:00:00Z', 'comments' => 4, 'labels' => [['name' => 'bug']], 'body' => "## Resumo\n\n**Corrige** o `onebox`.",
            'additions' => 10, 'deletions' => 2, 'changed_files' => 3, 'commits' => 2,
        ])];
        FakeGithubHttp::$responses[self::REPO.'/issues/7'] = ['status' => 200, 'body' => json_encode([
            'number' => 7, 'title' => 'Um problema', 'state' => 'open', 'user' => ['login' => 'outra'], 'created_at' => '2026-09-01T00:00:00Z', 'comments' => 0, 'labels' => [], 'body' => '<script>alert(1)</script>Texto',
        ])];

        $pull = $this->onebox('https://github.com/discourse/discourse/pull/123/files');

        $this->assertSame('pull', $pull['type']);
        $this->assertSame('merged', $pull['state']);
        $this->assertSame('Corrige o onebox', $pull['title']);
        $this->assertSame(['bug'], $pull['labels']);
        $this->assertSame('Resumo Corrige o onebox.', $pull['excerpt']);
        $this->assertSame([10, 2, 3, 2], [$pull['additions'], $pull['deletions'], $pull['files'], $pull['commits']]);
        $this->assertSame('https://github.com/discourse/discourse/pull/123', $pull['url']);
        $this->assertSame('Bearer token-secreto', FakeGithubHttp::$requests[0]['headers']['Authorization']);

        $issue = $this->onebox('https://github.com/discourse/discourse/issues/7');

        $this->assertSame('issue', $issue['type']);
        $this->assertSame('open', $issue['state']);
        $this->assertSame('alert(1)Texto', $issue['excerpt'], 'só texto, sem tags');
    }

    #[Test]
    public function commit_e_repositorio(): void
    {
        FakeGithubHttp::$responses[self::REPO] = self::repo();
        FakeGithubHttp::$responses[self::REPO.'/commits/abc1234'] = ['status' => 200, 'body' => json_encode([
            'sha' => 'abc1234def5678', 'commit' => ['message' => "Título do commit\n\nDetalhes.", 'author' => ['name' => 'Ramon', 'date' => '2026-10-01T00:00:00Z']],
            'author' => ['login' => 'ram0ng1'], 'stats' => ['additions' => 5, 'deletions' => 1], 'files' => [[], []],
        ])];

        $commit = $this->onebox('https://github.com/discourse/discourse/commit/abc1234');

        $this->assertSame(['commit', 'Título do commit', 'Detalhes.', 'ram0ng1', 2], [$commit['type'], $commit['title'], $commit['excerpt'], $commit['author'], $commit['files']]);

        $repo = $this->onebox('https://github.com/discourse/discourse');

        $this->assertSame(['repo', 'Uma plataforma', 44000, 'Ruby'], [$repo['type'], $repo['description'], $repo['stars'], $repo['language']]);
    }

    #[Test]
    public function release_por_tag_e_a_mais_recente(): void
    {
        FakeGithubHttp::$responses[self::REPO] = self::repo();
        $release = ['status' => 200, 'body' => json_encode([
            'tag_name' => 'v3.4.0', 'name' => 'Versão 3.4', 'prerelease' => false, 'author' => ['login' => 'ramon'],
            'published_at' => '2026-10-20T00:00:00Z', 'body' => "## Novidades\n\n- Onebox", 'assets' => [[], [], []],
        ])];
        FakeGithubHttp::$responses[self::REPO.'/releases/tags/v3.4.0'] = $release;
        FakeGithubHttp::$responses[self::REPO.'/releases/latest'] = $release;

        $card = $this->onebox('https://github.com/discourse/discourse/releases/tag/v3.4.0');

        $this->assertSame(['release', 'Versão 3.4', 'v3.4.0', 'release', 3], [$card['type'], $card['title'], $card['tag'], $card['state'], $card['assets']]);
        $this->assertSame('Novidades Onebox', $card['excerpt']);

        // A mais recente aponta para a release que o cartão mostra.
        $latest = $this->onebox('https://github.com/discourse/discourse/releases/latest');

        $this->assertSame('https://github.com/discourse/discourse/releases/tag/v3.4.0', $latest['url']);
    }

    /** Com um token que vê repositórios privados, o privado continua sem cartão. */
    #[Test]
    public function repositorio_privado_nao_vira_cartao(): void
    {
        $this->setting(OneboxSettings::GITHUB_TOKEN, 'token-secreto');
        FakeGithubHttp::$responses[self::REPO] = self::repo(true);
        FakeGithubHttp::$responses[self::REPO.'/issues/1'] = ['status' => 200, 'body' => json_encode(['number' => 1, 'title' => 'Segredo'])];

        $this->assertNull($this->onebox('https://github.com/discourse/discourse/issues/1'));
        $this->assertCount(1, FakeGithubHttp::$requests, 'nem pede a issue');
    }

    #[Test]
    public function o_que_nao_vira_cartao(): void
    {
        $this->assertNull($this->onebox('https://example.com/a/b'));
        $this->assertNull($this->onebox('https://github.com/a/b/blob/main/../../x'));
        // Não existe (404 no falso), e binário.
        $this->assertNull($this->onebox('https://github.com/a/b/blob/main/nada.php'));
        FakeGithubHttp::$responses['https://raw.githubusercontent.com/a/b/main/logo.png'] = ['status' => 200, 'body' => "\x89PNG\0\0"];
        $this->assertNull($this->onebox('https://github.com/a/b/blob/main/logo.png'));
        $this->assertCount(2, FakeGithubHttp::$requests);
    }

    #[Test]
    public function desligado_no_admin_e_404(): void
    {
        $this->setting(OneboxSettings::GITHUB, '0');

        $this->assertEquals(404, $this->send($this->request('GET', '/api/canela/onebox')->withQueryParams(['url' => 'https://github.com/a/b']))->getStatusCode());
    }
}
