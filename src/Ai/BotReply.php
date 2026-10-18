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

use Carbon\Carbon;
use Flarum\User\User;
use Ramon\Canela\Ai\Llm\LlmException;
use Ramon\Canela\Ai\Llm\LlmFactory;
use Ramon\Canela\Ai\Llm\LlmRequest;
use Ramon\Canela\Ai\Tools\AiTool;
use Ramon\Canela\Ai\Tools\ForumSearchTool;
use Ramon\Canela\Ai\Tools\ReadTopicTool;
use Throwable;

/**
 * Uma resposta do bot numa conversa, do começo ao fim:
 *
 * 1. grava a pergunta e conta o pedido no limite diário;
 * 2. monta o histórico (só o texto das mensagens anteriores) e o prompt da
 *    persona;
 * 3. transmite a resposta enquanto o modelo escreve, com as ferramentas que a
 *    persona pode usar;
 * 4. grava a resposta — também a parcial, se o provedor falhar no meio —, os
 *    tokens, e na primeira troca dá um título à conversa.
 *
 * Cada passo escreve uma linha no stream (`conversation`, `delta`, `tool`,
 * `message`, `title`), que a página de conversas desenha conforme chega.
 */
final class BotReply
{
    /** Quantas mensagens anteriores voltam ao modelo a cada pergunta. */
    private const HISTORY = 40;

    public function __construct(
        private readonly AiSettings $settings,
        private readonly Personas $personas,
        private readonly BotPrompt $prompt,
        private readonly LlmFactory $llm,
        private readonly ToolLoop $loop,
        private readonly UsageLimiter $usage,
        private readonly AiErrors $errors,
        private readonly ForumSearchTool $searchTool,
        private readonly ReadTopicTool $readTool,
    ) {
    }

    /**
     * @param callable(string, array<string, mixed>): void $write
     */
    public function stream(User $actor, Conversation $conversation, string $question, callable $write): void
    {
        $persona = $this->personas->find($conversation->persona);

        if ($persona === null) {
            throw new LlmException('not_configured', 'Nenhuma persona ligada.');
        }

        $isNew = ! $conversation->exists;
        $conversation->persona = $persona['id'];
        $conversation->user_id = $actor->id;
        $conversation->save();

        $history = $conversation->messages()->orderByDesc('id')->limit(self::HISTORY)->get()->reverse();

        $userMessage = $this->addMessage($conversation, Message::ROLE_USER, $question);
        $this->usage->countRequest($actor);

        $write('conversation', ['conversation' => $conversation->toSummaryArray(), 'userMessage' => $userMessage->toApiArray(), 'isNew' => $isNew]);

        $messages = [];

        foreach ($history as $previous) {
            /** @var Message $previous */
            if (trim($previous->content) !== '') {
                $messages[] = ['role' => $previous->role === Message::ROLE_ASSISTANT ? 'assistant' : 'user', 'content' => $previous->content];
            }
        }

        $messages[] = ['role' => 'user', 'content' => $question];

        $tools = $this->tools($persona);
        $webSearch = $persona['web'] && $this->llm->supportsWebSearch();

        $request = new LlmRequest(
            $this->settings->mainModel(),
            $this->prompt->system($persona, $actor, $webSearch),
            $messages,
            array_values(array_map(static fn (AiTool $tool) => $tool->definition(), $tools)),
            64000,
            'medium',
            $webSearch,
        );

        $text = '';
        $activities = [];
        $failure = null;
        $outcome = null;

        try {
            $outcome = $this->loop->run(
                $this->llm->make(),
                $request,
                $tools,
                $actor,
                static function (string $piece) use (&$text, $write): void {
                    $text .= $piece;
                    $write('delta', ['text' => $piece]);
                },
                static function (array $activity) use (&$activities, $write): void {
                    $activities[] = $activity;
                    $write('tool', ['activity' => $activity]);
                }
            );
        } catch (Throwable $error) {
            $failure = $error;
        }

        $notice = null;

        if ($outcome !== null && $outcome['stopReason'] === 'refusal') {
            $notice = $this->errors->message('refused');
        } elseif ($outcome !== null && $outcome['stopReason'] === 'max_tokens') {
            $notice = $this->errors->message('truncated');
        }

        // Uma resposta parcial também fica: ela já apareceu na tela, e o
        // histórico da próxima pergunta precisa dela.
        if ($text !== '' || $outcome !== null) {
            $content = $text;

            if ($notice !== null) {
                $content = trim($content."\n\n_".$notice.'_');
            }

            $assistant = $this->addMessage(
                $conversation,
                Message::ROLE_ASSISTANT,
                $content,
                $activities,
                $outcome['model'] ?? $request->model,
                $outcome['inputTokens'] ?? 0,
                $outcome['outputTokens'] ?? 0,
            );

            $this->usage->addTokens($actor, $outcome['inputTokens'] ?? 0, $outcome['outputTokens'] ?? 0);
            $write('message', ['message' => $assistant->toApiArray(), 'notice' => $notice]);
        }

        if ($failure !== null) {
            throw $failure;
        }

        if ($isNew || $conversation->title === null) {
            $title = $this->title($question, $text);
            $conversation->title = $title;
            $conversation->save();
            $write('title', ['conversationId' => (string) $conversation->id, 'title' => $title]);
        }
    }

    /**
     * @param array{search: bool, read: bool} $persona
     *
     * @return array<string, AiTool>
     */
    private function tools(array $persona): array
    {
        $tools = [];

        if ($persona['search']) {
            $tools[ForumSearchTool::NAME] = $this->searchTool;
        }

        if ($persona['read']) {
            $tools[ReadTopicTool::NAME] = $this->readTool;
        }

        return $tools;
    }

    /**
     * @param list<array<string, mixed>> $tools
     */
    private function addMessage(Conversation $conversation, string $role, string $content, array $tools = [], ?string $model = null, int $input = 0, int $output = 0): Message
    {
        $message = new Message();
        $message->conversation_id = $conversation->id;
        $message->role = $role;
        $message->content = $content;
        $message->tools = $tools !== [] ? $tools : null;
        $message->model = $model;
        $message->input_tokens = $input;
        $message->output_tokens = $output;
        $message->created_at = Carbon::now();
        $message->save();

        $conversation->message_count = $conversation->message_count + 1;
        $conversation->updated_at = Carbon::now();
        $conversation->save();

        return $message;
    }

    /**
     * O título da conversa, escrito pelo modelo rápido a partir da primeira
     * pergunta, como o Discourse faz. Se a chamada falhar, fica o começo da
     * pergunta — uma conversa sem título não se acha na barra lateral.
     */
    private function title(string $question, string $answer): string
    {
        $fallback = self::clip($question, 80);

        try {
            $result = $this->llm->make()->send(new LlmRequest(
                $this->settings->fastModel(),
                'Escreva um título curto (no máximo 8 palavras) para a conversa abaixo, no idioma da pergunta. Responda só com o título, sem aspas nem ponto final.',
                [['role' => 'user', 'content' => "Pergunta:\n".self::clip($question, 2000)."\n\nResposta:\n".self::clip($answer, 2000)]],
                [],
                1024,
                'low',
            ));
        } catch (Throwable) {
            return $fallback;
        }

        $title = trim(trim($result->text), "\"'“”«» \n.");

        return $title !== '' ? self::clip($title, 120) : $fallback;
    }

    private static function clip(string $text, int $length): string
    {
        $text = trim((string) preg_replace('/\s+/', ' ', $text));

        return mb_strlen($text) > $length ? rtrim(mb_substr($text, 0, $length - 1)).'…' : $text;
    }
}
