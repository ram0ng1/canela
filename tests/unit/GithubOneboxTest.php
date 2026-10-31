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

namespace Ramon\Canela\Tests\unit;

use PHPUnit\Framework\TestCase;
use Ramon\Canela\Onebox\GithubOnebox;
use Ramon\Canela\Onebox\GithubUrl;

final class GithubOneboxTest extends TestCase
{
    public function test_arquivo_com_linhas(): void
    {
        $url = GithubUrl::parse('https://github.com/discourse/discourse/blob/5e9779d4c/config/locales/client.en.yml#L597-L609');

        self::assertNotNull($url);
        self::assertSame(GithubUrl::FILE, $url->type);
        self::assertSame('discourse/discourse', $url->repoName());
        self::assertSame('5e9779d4c', $url->ref());
        self::assertSame('config/locales/client.en.yml', $url->path());
        self::assertSame([597, 609], [$url->startLine, $url->endLine]);
        self::assertSame('https://github.com/discourse/discourse/blob/5e9779d4c/config/locales/client.en.yml#L597-L609', $url->canonical());
    }

    public function test_outros_formatos(): void
    {
        self::assertSame(GithubUrl::ISSUE, GithubUrl::parse('https://github.com/flarum/framework/issues/4012')?->type);
        self::assertSame(GithubUrl::PULL, GithubUrl::parse('https://github.com/flarum/framework/pull/4100/files')?->type);
        self::assertSame(GithubUrl::COMMIT, GithubUrl::parse('https://github.com/flarum/framework/commit/ABCDEF1234567')?->type);
        self::assertSame('abcdef1234567', GithubUrl::parse('https://github.com/flarum/framework/commit/ABCDEF1234567')?->target);
        self::assertSame(GithubUrl::REPO, GithubUrl::parse('https://github.com/ram0ng1/canela')?->type);
        self::assertSame(GithubUrl::RELEASE, GithubUrl::parse('https://github.com/flarum/framework/releases/tag/v2.0.2')?->type);
        self::assertSame('v2.0.2', GithubUrl::parse('https://github.com/flarum/framework/releases/tag/v2.0.2')?->target);
        self::assertSame('core/v1.0', GithubUrl::parse('https://github.com/a/b/releases/tag/core/v1.0')?->target);
        self::assertSame('', GithubUrl::parse('https://github.com/flarum/framework/releases/latest')?->target);
        self::assertSame('https://github.com/flarum/framework/releases/latest', GithubUrl::parse('https://github.com/flarum/framework/releases/latest')?->canonical());
        self::assertSame(GithubUrl::REPO, GithubUrl::parse('https://www.github.com/ram0ng1/canela.git/')?->type);
        self::assertSame([42, 42], [GithubUrl::parse('https://github.com/a/b/blob/main/x.php#L42')?->startLine, GithubUrl::parse('https://github.com/a/b/blob/main/x.php#L42')?->endLine]);
        self::assertSame([5, 9], [GithubUrl::parse('https://github.com/a/b/blob/main/x.php#L9-L5')?->startLine, GithubUrl::parse('https://github.com/a/b/blob/main/x.php#L9-L5')?->endLine]);
    }

    public function test_recusa_o_que_nao_e_do_formato(): void
    {
        foreach ([
            'http://github.com/a/b',
            'https://gist.github.com/a/b',
            'https://github.com.evil.com/a/b',
            'https://user:pass@github.com/a/b',
            'https://github.com:8080/a/b',
            'https://github.com/a',
            'https://github.com/settings/profile',
            'https://github.com/a/b/blob/main/../../etc/passwd',
            'https://github.com/a/b/blob/main/%2e%2e/x',
            'https://github.com/a/b/tree/main/src',
            'https://github.com/a/b/issues/abc',
            'https://github.com/a/b/commit/zzz',
            'https://github.com/a/b/releases',
            'https://github.com/a/b/releases/tag/../x',
            'https://github.com/a/b/releases/tag/v1%0Ax',
            'https://github.com/-a/b',
            'javascript:alert(1)',
        ] as $bad) {
            self::assertNull(GithubUrl::parse($bad), $bad);
        }
    }

    public function test_faixa_de_linhas(): void
    {
        self::assertSame([1, 10, null], GithubOnebox::range(null, null, 300));
        self::assertSame([1, 4, null], GithubOnebox::range(null, null, 4));
        self::assertSame([39, 45, [42, 42]], GithubOnebox::range(42, 42, 300));
        self::assertSame([1, 4, [1, 1]], GithubOnebox::range(1, 1, 300));
        self::assertSame([597, 609, null], GithubOnebox::range(597, 609, 700));
        // No máximo 50 linhas, e não além do fim do arquivo.
        self::assertSame([10, 59, null], GithubOnebox::range(10, 500, 700));
        self::assertSame([10, 20, null], GithubOnebox::range(10, 30, 20));
    }

    public function test_trecho_do_markdown(): void
    {
        self::assertSame(
            'Título O botão some. Veja o link e use foo().',
            GithubOnebox::excerpt("## Título\n\n![img](x.png) O **botão** some. <!-- nada -->\n\nVeja [o link](https://x) e use `foo()`.\n\n```php\ncodigo\n```")
        );
    }
}
