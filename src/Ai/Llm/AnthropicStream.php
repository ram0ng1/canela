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

/**
 * Monta a mensagem da Anthropic a partir dos eventos do stream.
 *
 * Cada bloco nasce no `content_block_start` e cresce com os deltas: texto,
 * pedaços de JSON da entrada de uma ferramenta, raciocínio e a assinatura dele,
 * citações. Os blocos que o tema não conhece são guardados como chegaram — o
 * `echoableBlocks` do cliente decide o que volta no próximo pedido.
 */
final class AnthropicStream
{
    /** @var array<int, array<string, mixed>> */
    private array $blocks = [];

    /** @var array<int, string> o JSON parcial de cada bloco com entrada */
    private array $partialJson = [];

    public string $stopReason = 'end_turn';

    public string $model = '';

    public int $inputTokens = 0;

    public int $outputTokens = 0;

    /** @var array{type: string, message: string}|null */
    public ?array $error = null;

    /**
     * @param callable(string): void $onText
     */
    public function __construct(
        private $onText,
    ) {
    }

    public function handle(string $event, string $data): void
    {
        $payload = json_decode($data, true);

        if (! is_array($payload)) {
            return;
        }

        switch ($payload['type'] ?? $event) {
            case 'message_start':
                $message = $payload['message'] ?? [];
                $this->model = (string) ($message['model'] ?? '');
                $usage = $message['usage'] ?? [];
                $this->inputTokens = (int) ($usage['input_tokens'] ?? 0) + (int) ($usage['cache_read_input_tokens'] ?? 0) + (int) ($usage['cache_creation_input_tokens'] ?? 0);
                $this->outputTokens = (int) ($usage['output_tokens'] ?? 0);
                break;

            case 'content_block_start':
                $index = (int) ($payload['index'] ?? count($this->blocks));
                $this->blocks[$index] = is_array($payload['content_block'] ?? null) ? $payload['content_block'] : ['type' => 'unknown'];
                break;

            case 'content_block_delta':
                $this->delta((int) ($payload['index'] ?? 0), $payload['delta'] ?? []);
                break;

            case 'content_block_stop':
                $this->closeBlock((int) ($payload['index'] ?? 0));
                break;

            case 'message_delta':
                if (isset($payload['delta']['stop_reason'])) {
                    $this->stopReason = (string) $payload['delta']['stop_reason'];
                }

                if (isset($payload['usage']['output_tokens'])) {
                    $this->outputTokens = (int) $payload['usage']['output_tokens'];
                }
                break;

            case 'error':
                $this->error = [
                    'type' => (string) ($payload['error']['type'] ?? 'api_error'),
                    'message' => (string) ($payload['error']['message'] ?? 'Erro no stream do provedor.'),
                ];
                break;
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function blocks(): array
    {
        // Um bloco sem content_block_stop (stream cortado) ainda fecha a entrada.
        foreach (array_keys($this->partialJson) as $index) {
            $this->closeBlock($index);
        }

        ksort($this->blocks);

        return array_values($this->blocks);
    }

    /**
     * @param array<string, mixed> $delta
     */
    private function delta(int $index, array $delta): void
    {
        $this->blocks[$index] ??= ['type' => 'text', 'text' => ''];

        switch ($delta['type'] ?? '') {
            case 'text_delta':
                $text = (string) ($delta['text'] ?? '');
                $this->blocks[$index]['text'] = ($this->blocks[$index]['text'] ?? '').$text;

                if ($text !== '') {
                    ($this->onText)($text);
                }
                break;

            case 'input_json_delta':
                $this->partialJson[$index] = ($this->partialJson[$index] ?? '').(string) ($delta['partial_json'] ?? '');
                break;

            case 'thinking_delta':
                $this->blocks[$index]['thinking'] = ($this->blocks[$index]['thinking'] ?? '').(string) ($delta['thinking'] ?? '');
                break;

            case 'signature_delta':
                $this->blocks[$index]['signature'] = ($this->blocks[$index]['signature'] ?? '').(string) ($delta['signature'] ?? '');
                break;

            case 'citations_delta':
                if (isset($delta['citation'])) {
                    $this->blocks[$index]['citations'][] = $delta['citation'];
                }
                break;
        }
    }

    private function closeBlock(int $index): void
    {
        if (! array_key_exists($index, $this->partialJson)) {
            return;
        }

        $json = trim($this->partialJson[$index]);
        unset($this->partialJson[$index]);

        // Sem nenhum pedaço, a entrada é o objeto vazio. Com pedaços que não
        // formam um JSON válido (stream cortado, `max_tokens`), a entrada fica
        // marcada como inválida: a ferramenta não roda, e o erro volta ao modelo.
        $decoded = $json === '' ? [] : json_decode($json, true);
        $this->blocks[$index]['input'] = is_array($decoded) ? $decoded : false;
    }
}
