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

namespace Ramon\Canela\Ai;

use Flarum\User\User;
use Ramon\Canela\Ai\Llm\LlmClient;
use Ramon\Canela\Ai\Llm\LlmRequest;
use Ramon\Canela\Ai\Tools\AiTool;
use Ramon\Canela\Support\Log;
use Throwable;

/**
 * O laço das ferramentas: pergunta ao modelo, roda as ferramentas que ele
 * pedir (como a pessoa que conversa), devolve os resultados e repete até ele
 * responder — ou até o teto de voltas, quando as ferramentas pendentes voltam
 * como erro e ele responde com o que já tem.
 *
 * O texto de todas as voltas vai para o navegador conforme chega; entre uma
 * volta e outra entra uma linha em branco, para o "vou pesquisar…" da primeira
 * não grudar na resposta da segunda.
 */
final class ToolLoop
{
    private const MAX_ROUNDS = 6;

    /**
     * @param array<string, AiTool> $tools por nome
     * @param callable(string): void $onText
     * @param callable(array<string, mixed>): void $onActivity cada ferramenta que rodou
     *
     * @return array{text: string, activities: list<array<string, mixed>>, model: string, inputTokens: int, outputTokens: int, stopReason: string}
     */
    public function run(LlmClient $client, LlmRequest $request, array $tools, User $actor, callable $onText, callable $onActivity): array
    {
        $text = '';
        $activities = [];
        $model = $request->model;
        $inputTokens = 0;
        $outputTokens = 0;
        $stopReason = 'end_turn';

        for ($round = 0; $round < self::MAX_ROUNDS; $round++) {
            $startedRound = false;

            $result = $client->send($request, static function (string $piece) use (&$text, &$startedRound, $onText): void {
                if (! $startedRound && $text !== '' && ! str_ends_with($text, "\n\n")) {
                    $text .= "\n\n";
                    $onText("\n\n");
                }

                $startedRound = true;
                $text .= $piece;
                $onText($piece);
            });

            $model = $result->model;
            $inputTokens += $result->inputTokens;
            $outputTokens += $result->outputTokens;
            $stopReason = $result->stopReason;

            if ($result->paused()) {
                $request = $request->withMessages([...$request->messages, ['role' => 'assistant_raw', 'raw' => $result->raw]]);
                continue;
            }

            if (! $result->wantsTools()) {
                break;
            }

            $lastRound = $round === self::MAX_ROUNDS - 1;
            $results = [];

            foreach ($result->toolCalls as $call) {
                $results[] = $this->runTool($call, $tools, $actor, $lastRound, $activities, $onActivity);
            }

            $request = $request->withMessages([
                ...$request->messages,
                ['role' => 'assistant_raw', 'raw' => $result->raw],
                ['role' => 'tool_results', 'results' => $results],
            ]);
        }

        return compact('text', 'activities', 'model', 'inputTokens', 'outputTokens', 'stopReason');
    }

    /**
     * @param array{id: string, name: string, input: array<string, mixed>, valid: bool} $call
     * @param array<string, AiTool> $tools
     * @param list<array<string, mixed>> $activities
     *
     * @return array{id: string, name: string, content: string, error: bool}
     */
    private function runTool(array $call, array $tools, User $actor, bool $lastRound, array &$activities, callable $onActivity): array
    {
        $tool = $tools[$call['name']] ?? null;
        $error = static fn (string $message): array => ['id' => $call['id'], 'name' => $call['name'], 'content' => $message, 'error' => true];

        if ($lastRound) {
            return $error('Limite de consultas atingido nesta resposta. Responda agora com o que já encontrou.');
        }

        if (! $tool) {
            return $error(sprintf('A ferramenta "%s" não existe.', $call['name']));
        }

        if (! $call['valid'] || ($problem = self::validate($call['input'], $tool->definition()->schema)) !== null) {
            return $error('Entrada inválida: '.($problem ?? 'JSON incompleto').'. Chame a ferramenta de novo com uma entrada válida.');
        }

        try {
            $output = $tool->run($call['input'], $actor);
        } catch (Throwable $exception) {
            Log::warning('ferramenta de IA '.$call['name'].' falhou: '.$exception->getMessage());

            return $error('A ferramenta falhou. Tente de outro jeito ou responda sem ela.');
        }

        $activities[] = $output->activity;
        $onActivity($output->activity);

        return ['id' => $call['id'], 'name' => $call['name'], 'content' => $output->content, 'error' => $output->error];
    }

    /**
     * Confere a entrada contra o schema (só o que as ferramentas do tema usam:
     * campos obrigatórios e tipos simples). Com o streaming antecipado da
     * entrada, a API não valida mais nada — quem valida é aqui.
     *
     * @param array<string, mixed> $input
     * @param array<string, mixed> $schema
     */
    public static function validate(array $input, array $schema): ?string
    {
        foreach ($schema['required'] ?? [] as $name) {
            if (! array_key_exists($name, $input)) {
                return sprintf('falta o campo "%s"', $name);
            }
        }

        foreach ($input as $name => $value) {
            $type = $schema['properties'][$name]['type'] ?? null;

            if ($type === null) {
                return sprintf('campo desconhecido "%s"', $name);
            }

            $ok = match ($type) {
                'string' => is_string($value),
                'integer' => is_int($value) || (is_string($value) && ctype_digit($value)),
                'boolean' => is_bool($value),
                'array' => is_array($value) && array_is_list($value),
                default => true,
            };

            if (! $ok) {
                return sprintf('o campo "%s" deveria ser %s', $name, $type);
            }
        }

        return null;
    }
}
