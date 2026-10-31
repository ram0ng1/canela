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

namespace Ramon\Canela\Onebox;

use GuzzleHttp\Client;
use Throwable;

/**
 * O GithubHttp de verdade. Sem seguir redirecionamentos (o endereço montado é
 * o único destino) e lendo no máximo `$maxBytes`: um arquivo enorme não passa
 * inteiro pela memória do PHP.
 */
final class GuzzleGithubHttp implements GithubHttp
{
    private const HOSTS = ['api.github.com', 'raw.githubusercontent.com'];

    private ?Client $client = null;

    #[\Override]
    public function get(string $url, array $headers, int $maxBytes): array
    {
        if (! in_array(parse_url($url, PHP_URL_HOST), self::HOSTS, true) || ! str_starts_with($url, 'https://')) {
            return ['status' => 0, 'body' => ''];
        }

        try {
            $response = ($this->client ??= new Client())->get($url, [
                'headers' => $headers + ['User-Agent' => 'ramon-canela-onebox'],
                'http_errors' => false,
                'allow_redirects' => false,
                'connect_timeout' => 5,
                'timeout' => 10,
                'stream' => true,
            ]);

            $stream = $response->getBody();
            $body = '';

            while (! $stream->eof() && strlen($body) <= $maxBytes) {
                $body .= $stream->read(65536);
            }

            $stream->close();

            // Passou do limite: conta como grande demais, e não como o começo do arquivo.
            return strlen($body) > $maxBytes ? ['status' => 413, 'body' => ''] : ['status' => $response->getStatusCode(), 'body' => $body];
        } catch (Throwable) {
            return ['status' => 0, 'body' => ''];
        }
    }
}
