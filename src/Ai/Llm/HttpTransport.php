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

namespace Ramon\Canela\Ai\Llm;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use Psr\Http\Message\ResponseInterface;

/**
 * O POST de JSON aos provedores, pelo Guzzle que o core já traz.
 *
 * Com `$onChunk`, o corpo da resposta é entregue enquanto chega (SSE); sem,
 * vem inteiro. Os erros HTTP não viram exceção do Guzzle (`http_errors`
 * desligado): o status e o corpo voltam para o cliente do provedor ler a
 * mensagem de erro no formato dele.
 */
final class HttpTransport
{
    private ?Client $client = null;

    /**
     * @param array<string, string> $headers
     * @param array<string, mixed> $body
     * @param (callable(string): bool)|null $onChunk
     *
     * @return array{status: int, body: string}
     *
     * @throws LlmException
     */
    public function postJson(string $url, array $headers, array $body, ?callable $onChunk = null, int $timeout = 300): array
    {
        $status = 0;
        $sink = $onChunk ? new ChunkSink(static function (string $chunk) use (&$status, $onChunk): bool {
            // Uma resposta de erro chega pelo mesmo caminho, mas não é SSE:
            // fica guardada no sink e é lida depois.
            if ($status < 200 || $status >= 300) {
                return true;
            }

            // connection_aborted() só muda depois de uma escrita para o
            // navegador, que o próprio $onChunk faz ao repassar o texto.
            return $onChunk($chunk) !== false && connection_aborted() === 0;
        }) : null;

        $options = [
            'headers' => $headers + ['Content-Type' => 'application/json', 'Accept' => $onChunk ? 'text/event-stream' : 'application/json'],
            'body' => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR),
            'http_errors' => false,
            // Sem seguir redirecionamentos: o endereço configurado é o único
            // destino (um 30x levaria a chave para outro host, ou para a rede interna).
            'allow_redirects' => false,
            'connect_timeout' => 15,
            'timeout' => $timeout,
            'on_headers' => static function (ResponseInterface $response) use (&$status): void {
                $status = $response->getStatusCode();
            },
        ];

        if ($sink) {
            $options['sink'] = $sink;
        }

        try {
            $response = $this->client()->post($url, $options);
        } catch (RequestException $error) {
            // O sink devolveu 0 (a pessoa fechou a página): não é falha do provedor.
            if ($sink && connection_aborted()) {
                throw new LlmException('aborted', 'Conexão encerrada pelo navegador.');
            }

            throw new LlmException('network', $error->getMessage());
        } catch (GuzzleException $error) {
            throw new LlmException('network', $error->getMessage());
        }

        return [
            'status' => $response->getStatusCode(),
            'body' => $sink ? $sink->kept() : (string) $response->getBody(),
        ];
    }

    private function client(): Client
    {
        return $this->client ??= new Client();
    }
}
