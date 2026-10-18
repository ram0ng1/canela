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
 * Qualquer servidor compatível com a API de chat da OpenAI
 * (`POST {base}/chat/completions`): a própria OpenAI, OpenRouter, Groq,
 * Mistral, DeepSeek, ou um servidor local (Ollama, LM Studio, vLLM).
 *
 * Só o formato comum entre eles: mensagens, ferramentas de função e streaming
 * por SSE. Os campos que só a OpenAI aceita (`stream_options`,
 * `max_completion_tokens`) só vão para ela — um servidor mais estrito
 * recusaria o pedido inteiro por causa de um campo desconhecido.
 */
final class OpenAiClient implements LlmClient
{
    public function __construct(
        private readonly HttpTransport $http,
        private readonly string $baseUrl,
        private readonly string $apiKey,
    ) {
    }

    #[\Override]
    public function send(LlmRequest $request, ?callable $onText = null): LlmResult
    {
        $url = rtrim($this->baseUrl, '/').'/chat/completions';
        $official = str_contains((string) parse_url($url, PHP_URL_HOST), 'openai.com');
        $headers = $this->apiKey !== '' ? ['Authorization' => 'Bearer '.$this->apiKey] : [];

        $body = [
            'model' => $request->model,
            'messages' => $this->messages($request),
            $official ? 'max_completion_tokens' : 'max_tokens' => $request->maxTokens,
        ];

        if ($request->tools !== []) {
            $body['tools'] = array_map(static fn (ToolDefinition $tool): array => [
                'type' => 'function',
                'function' => ['name' => $tool->name, 'description' => $tool->description, 'parameters' => $tool->schema],
            ], $request->tools);
        }

        if ($onText === null) {
            $response = $this->http->postJson($url, $headers, $body, null, 120);
            $this->assertOk($response);
            $data = json_decode($response['body'], true);
            $choice = is_array($data) ? ($data['choices'][0] ?? []) : [];
            $message = $choice['message'] ?? [];

            $calls = array_map(static fn (array $call): array => [
                'id' => (string) ($call['id'] ?? ''),
                'name' => (string) ($call['function']['name'] ?? ''),
                'arguments' => (string) ($call['function']['arguments'] ?? ''),
            ], is_array($message['tool_calls'] ?? null) ? $message['tool_calls'] : []);

            return $this->result(
                (string) ($message['content'] ?? ''),
                $calls,
                (string) ($choice['finish_reason'] ?? 'stop'),
                (string) ($data['model'] ?? $request->model),
                (int) ($data['usage']['prompt_tokens'] ?? 0),
                (int) ($data['usage']['completion_tokens'] ?? 0),
            );
        }

        $body['stream'] = true;

        if ($official) {
            $body['stream_options'] = ['include_usage' => true];
        }

        $text = '';
        $calls = [];
        $finish = 'stop';
        $model = $request->model;
        $usage = [0, 0];

        $parser = new SseParser(static function (string $event, string $data) use (&$text, &$calls, &$finish, &$model, &$usage, $onText): void {
            if (trim($data) === '[DONE]') {
                return;
            }

            $chunk = json_decode($data, true);

            if (! is_array($chunk)) {
                return;
            }

            $model = (string) ($chunk['model'] ?? $model);

            if (isset($chunk['usage']['prompt_tokens'])) {
                $usage = [(int) $chunk['usage']['prompt_tokens'], (int) ($chunk['usage']['completion_tokens'] ?? 0)];
            }

            $choice = $chunk['choices'][0] ?? null;

            if (! is_array($choice)) {
                return;
            }

            $delta = $choice['delta'] ?? [];
            $piece = (string) ($delta['content'] ?? '');

            if ($piece !== '') {
                $text .= $piece;
                $onText($piece);
            }

            foreach (is_array($delta['tool_calls'] ?? null) ? $delta['tool_calls'] : [] as $call) {
                $index = (int) ($call['index'] ?? 0);
                $calls[$index] ??= ['id' => '', 'name' => '', 'arguments' => ''];
                $calls[$index]['id'] = (string) ($call['id'] ?? $calls[$index]['id']);
                $calls[$index]['name'] .= (string) ($call['function']['name'] ?? '');
                $calls[$index]['arguments'] .= (string) ($call['function']['arguments'] ?? '');
            }

            if (! empty($choice['finish_reason'])) {
                $finish = (string) $choice['finish_reason'];
            }
        });

        $response = $this->http->postJson($url, $headers, $body, static function (string $chunk) use ($parser): bool {
            $parser->feed($chunk);

            return true;
        });

        $parser->finish();
        $this->assertOk($response);
        ksort($calls);

        return $this->result($text, array_values($calls), $finish, $model, $usage[0], $usage[1]);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function messages(LlmRequest $request): array
    {
        $out = $request->system !== '' ? [['role' => 'system', 'content' => $request->system]] : [];

        foreach ($request->messages as $message) {
            switch ($message['role']) {
                case 'user':
                case 'assistant':
                    $out[] = ['role' => $message['role'], 'content' => (string) $message['content']];
                    break;
                case 'assistant_raw':
                    $out[] = $message['raw'];
                    break;
                case 'tool_results':
                    foreach ($message['results'] as $result) {
                        $out[] = ['role' => 'tool', 'tool_call_id' => $result['id'], 'content' => (string) $result['content']];
                    }
                    break;
            }
        }

        return $out;
    }

    /**
     * @param list<array{id: string, name: string, arguments: string}> $calls
     */
    private function result(string $text, array $calls, string $finish, string $model, int $inputTokens, int $outputTokens): LlmResult
    {
        $toolCalls = [];
        $rawCalls = [];

        foreach ($calls as $index => $call) {
            $id = $call['id'] !== '' ? $call['id'] : 'call_'.$index;
            $arguments = trim($call['arguments']);
            $input = $arguments === '' ? [] : json_decode($arguments, true);

            $toolCalls[] = ['id' => $id, 'name' => $call['name'], 'input' => is_array($input) ? $input : [], 'valid' => is_array($input)];
            $rawCalls[] = ['id' => $id, 'type' => 'function', 'function' => ['name' => $call['name'], 'arguments' => $arguments !== '' ? $arguments : '{}']];
        }

        $raw = ['role' => 'assistant', 'content' => $text !== '' ? $text : null];

        if ($rawCalls !== []) {
            $raw['tool_calls'] = $rawCalls;
        }

        // A OpenAI diz `tool_calls`, `length` e `content_filter`; o resto do
        // tema fala a língua da Anthropic.
        $stopReason = match ($finish) {
            'tool_calls', 'function_call' => 'tool_use',
            'length' => 'max_tokens',
            'content_filter' => 'refusal',
            default => $toolCalls !== [] ? 'tool_use' : 'end_turn',
        };

        return new LlmResult($text, $toolCalls, $raw, $stopReason, $model, $inputTokens, $outputTokens);
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
        $message = is_array($error) ? (string) ($error['error']['message'] ?? $error['message'] ?? '') : trim(substr($response['body'], 0, 300));

        throw LlmException::fromStatus($response['status'], $message);
    }
}
