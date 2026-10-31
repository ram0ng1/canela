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

use Ramon\Canela\Onebox\GithubHttp;

/**
 * O GitHub falso dos testes: respostas por endereço, e os pedidos feitos
 * ficam em `$requests`. Estado estático: cada teste roda num processo próprio.
 */
final class FakeGithubHttp implements GithubHttp
{
    /** @var array<string, array{status: int, body: string}> */
    public static array $responses = [];

    /** @var list<array{url: string, headers: array<string, string>}> */
    public static array $requests = [];

    #[\Override]
    public function get(string $url, array $headers, int $maxBytes): array
    {
        self::$requests[] = ['url' => $url, 'headers' => $headers];

        return self::$responses[$url] ?? ['status' => 404, 'body' => ''];
    }
}
