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
 * A API Messages da Anthropic (`POST /v1/messages`), com streaming SSE.
 *
 * - O raciocínio fica no padrão dos modelos atuais (adaptativo); o que se
 *   ajusta é o esforço (`output_config.effort`), baixo nas tarefas rápidas.
 * - Os blocos de raciocínio voltam intactos, com a assinatura, quando o turno
 *   continua depois de uma ferramenta — a API recusa um turno remendado.
 * - Opus e Sonnet pedem o `fallbacks: "default"`: quando um classificador de
 *   segurança recusa um pedido legítimo, a própria API refaz o pedido no
 *   modelo recomendado para aquele caso, em vez de devolver a recusa.
 * - Cache automático do prompt (`cache_control` no topo): numa conversa longa
 *   o histórico repetido sai bem mais barato a partir da segunda mensagem.
 */
final class AnthropicClient implements LlmClient
{
    private const URL = 'https://api.anthropic.com/v1/messages';

    private const VERSION = '2023-06-01';

    private const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

    public function __construct(
        private readonly HttpTransport $http,
        private readonly string $apiKey,
    ) {
    }

    #[\Override]
    public function send(LlmRequest $request, ?callable $onText = null): LlmResult
    {
        $body = $this->body($request, $onText !== null);
        $headers = [
            'x-api-key' => $this->apiKey,
            'anthropic-version' => self::VERSION,
        ];

        if (isset($body['fallbacks'])) {
            $headers['anthropic-beta'] = self::FALLBACK_BETA;
        }

        if ($onText === null) {
            $response = $this->http->postJson(self::URL, $headers, $body, null, 120);
            $this->assertOk($response);

            $message = json_decode($response['body'], true);

            if (! is_array($message)) {
                throw new LlmException('server', 'Resposta inválida do provedor.');
            }

            return $this->result(
                $message['content'] ?? [],
                (string) ($message['stop_reason'] ?? 'end_turn'),
                (string) ($message['model'] ?? $request->model),
                (int) ($message['usage']['input_tokens'] ?? 0) + (int) ($message['usage']['cache_read_input_tokens'] ?? 0),
                (int) ($message['usage']['output_tokens'] ?? 0),
            );
        }

        $stream = new AnthropicStream($onText);
        $parser = new SseParser($stream->handle(...));

        $response = $this->http->postJson(self::URL, $headers, $body, static function (string $chunk) use ($parser): bool {
            $parser->feed($chunk);

            return true;
        });

        $parser->finish();
        $this->assertOk($response);

        if ($stream->error !== null) {
            throw new LlmException($stream->error['type'] === 'overloaded_error' ? 'overloaded' : 'server', $stream->error['message']);
        }

        return $this->result($stream->blocks(), $stream->stopReason, $stream->model ?: $request->model, $stream->inputTokens, $stream->outputTokens);
    }

    /**
     * @return array<string, mixed>
     */
    private function body(LlmRequest $request, bool $stream): array
    {
        $body = [
            'model' => $request->model,
            'max_tokens' => $request->maxTokens,
            'messages' => $this->messages($request->messages),
            'cache_control' => ['type' => 'ephemeral'],
        ];

        if ($request->system !== '') {
            $body['system'] = $request->system;
        }

        if ($stream) {
            $body['stream'] = true;
        }

        if (self::currentGeneration($request->model)) {
            $body['output_config'] = ['effort' => $request->effort];
        }

        if (self::supportsFallbacks($request->model)) {
            $body['fallbacks'] = 'default';
        }

        $tools = array_map(static fn (ToolDefinition $tool): array => [
            'name' => $tool->name,
            'description' => $tool->description,
            'input_schema' => $tool->schema,
            // O schema é seguido à risca, e a entrada chega sem esperar o
            // servidor juntar tudo; quem valida a entrada é o laço (ToolLoop).
            'strict' => true,
            'eager_input_streaming' => $stream,
        ], $request->tools);

        if ($request->webSearch) {
            $tools[] = [
                'type' => self::dynamicWebSearch($request->model) ? 'web_search_20260209' : 'web_search_20250305',
                'name' => 'web_search',
                'max_uses' => 5,
            ];
        }

        if ($tools !== []) {
            $body['tools'] = $tools;
        }

        return $body;
    }

    /**
     * @param list<array<string, mixed>> $messages
     *
     * @return list<array<string, mixed>>
     */
    private function messages(array $messages): array
    {
        $out = [];

        foreach ($messages as $message) {
            switch ($message['role']) {
                case 'user':
                case 'assistant':
                    $out[] = ['role' => $message['role'], 'content' => (string) $message['content']];
                    break;
                case 'assistant_raw':
                    $out[] = ['role' => 'assistant', 'content' => $message['raw']];
                    break;
                case 'tool_results':
                    // Todos os resultados de um turno numa mensagem só: separados,
                    // o modelo aprende a parar de chamar ferramentas em paralelo.
                    $out[] = ['role' => 'user', 'content' => array_map(static fn (array $result): array => array_filter([
                        'type' => 'tool_result',
                        'tool_use_id' => $result['id'],
                        'content' => (string) $result['content'],
                        'is_error' => ! empty($result['error']) ? true : null,
                    ], static fn ($value): bool => $value !== null), $message['results'])];
                    break;
            }
        }

        return $out;
    }

    /**
     * @param list<array<string, mixed>> $blocks
     */
    private function result(array $blocks, string $stopReason, string $model, int $inputTokens, int $outputTokens): LlmResult
    {
        $blocks = self::echoableBlocks($blocks);
        $text = '';
        $toolCalls = [];

        foreach ($blocks as $block) {
            $type = $block['type'] ?? '';

            if ($type === 'text') {
                $text .= (string) ($block['text'] ?? '');
            } elseif ($type === 'tool_use') {
                $input = $block['input'] ?? null;
                $toolCalls[] = [
                    'id' => (string) ($block['id'] ?? ''),
                    'name' => (string) ($block['name'] ?? ''),
                    'input' => is_array($input) ? $input : [],
                    'valid' => is_array($input),
                ];
            }
        }

        // A entrada de cada ferramenta tem de voltar como objeto JSON, mesmo a
        // que chegou cortada (essa volta como erro, e o modelo tenta de novo).
        // O json_decode associativo transforma `{}` em `[]`, que voltaria como
        // lista — daí o stdClass para a entrada vazia.
        $raw = array_map(static function (array $block): array {
            $isToolUse = in_array($block['type'] ?? '', ['tool_use', 'server_tool_use'], true);

            if ($isToolUse && (! is_array($block['input'] ?? null) || $block['input'] === [])) {
                $block['input'] = new \stdClass();
            }

            return $block;
        }, $blocks);

        return new LlmResult($text, $toolCalls, $raw, $stopReason, $model, $inputTokens, $outputTokens);
    }

    /**
     * Os blocos que podem voltar no próximo pedido.
     *
     * Depois de uma troca de modelo no meio da resposta (o bloco `fallback`),
     * o raciocínio, as ferramentas e os blocos internos que vieram ANTES da
     * troca são do modelo que recusou: voltam só os textos dessa parte, e tudo
     * o que veio depois. O próprio marcador é só auditoria e sai.
     *
     * @param list<array<string, mixed>> $blocks
     *
     * @return list<array<string, mixed>>
     */
    public static function echoableBlocks(array $blocks): array
    {
        $boundary = null;

        foreach ($blocks as $index => $block) {
            if (($block['type'] ?? '') === 'fallback') {
                $boundary = $index;
            }
        }

        $known = ['text', 'thinking', 'redacted_thinking', 'tool_use', 'server_tool_use', 'web_search_tool_result', 'web_fetch_tool_result'];
        $out = [];

        foreach ($blocks as $index => $block) {
            $type = $block['type'] ?? '';

            if ($type === 'fallback' || ! in_array($type, $known, true)) {
                continue;
            }

            if ($boundary !== null && $index < $boundary && $type !== 'text' && $type !== 'web_search_tool_result' && $type !== 'web_fetch_tool_result') {
                continue;
            }

            $out[] = $block;
        }

        // Um server_tool_use sem o resultado logo depois não pode voltar.
        return array_values(array_filter($out, static function (array $block, int $index) use ($out): bool {
            if (($block['type'] ?? '') !== 'server_tool_use') {
                return true;
            }

            $next = $out[$index + 1]['type'] ?? '';

            return str_ends_with($next, '_tool_result');
        }, ARRAY_FILTER_USE_BOTH));
    }

    /**
     * @param array{status: int, body: string} $response
     */
    private function assertOk(array $response): void
    {
        if ($response['status'] >= 200 && $response['status'] < 300) {
            return;
        }

        $error = json_decode($response['body'], true);
        $message = is_array($error) ? (string) ($error['error']['message'] ?? '') : '';

        throw LlmException::fromStatus($response['status'], $message);
    }

    /** Os modelos da geração 5 aceitam `output_config.effort`; os antigos dariam 400. */
    public static function currentGeneration(string $model): bool
    {
        return (bool) preg_match('/^claude-(opus|sonnet|haiku|fable)-5/', $model);
    }

    /** Haiku não tem fallback no servidor; mandar o parâmetro só atrasaria a recusa. */
    private static function supportsFallbacks(string $model): bool
    {
        return (bool) preg_match('/^claude-(opus-5|sonnet-5-5)/', $model);
    }

    private static function dynamicWebSearch(string $model): bool
    {
        return (bool) preg_match('/^claude-(opus-5|sonnet-5)/', $model);
    }
}
