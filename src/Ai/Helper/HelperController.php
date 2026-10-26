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

namespace Ramon\Canela\Ai\Helper;

use Flarum\Extension\ExtensionManager;
use Flarum\Foundation\ValidationException;
use Flarum\Http\RequestUtil;
use Flarum\Locale\TranslatorInterface;
use Flarum\User\User;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\AiErrors;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Http\AiGate;
use Ramon\Canela\Ai\Http\NdjsonStream;
use Ramon\Canela\Ai\Llm\LlmException;
use Ramon\Canela\Ai\Llm\LlmFactory;
use Ramon\Canela\Ai\Llm\LlmRequest;
use Ramon\Canela\Ai\UsageLimiter;

/**
 * `POST /api/canela/ai/helper`: o ajudante de IA do editor.
 *
 * - Modos de texto (revisar, traduzir, simplificar, tabela, explicar, prompt
 *   personalizado): a resposta vem em streaming (NDJSON), para o modal de
 *   "Edições sugeridas" mostrar o texto novo enquanto é escrito.
 * - Sugestões (títulos, categoria e etiquetas): JSON comum, com a lista.
 *
 * As etiquetas sugeridas só podem ser das que a pessoa vê: a lista oferecida
 * ao modelo já é a visível para ela, e os ids da resposta são conferidos
 * contra essa lista — um id inventado some.
 */
final class HelperController implements RequestHandlerInterface
{
    private const MAX_TEXT = 20000;

    public function __construct(
        private readonly AiGate $gate,
        private readonly AiSettings $settings,
        private readonly LlmFactory $llm,
        private readonly UsageLimiter $usage,
        private readonly AiErrors $errors,
        private readonly TranslatorInterface $translator,
        private readonly ExtensionManager $extensions,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->gate->feature(AiSettings::HELPER);

        $actor = RequestUtil::getActor($request);
        $this->gate->user($actor);
        $this->gate->quota($actor);

        $body = AiGate::body($request);
        $mode = (string) ($body['mode'] ?? '');
        $text = trim((string) ($body['text'] ?? ''));

        if (! in_array($mode, [...HelperPrompts::TEXT_MODES, ...HelperPrompts::SUGGESTION_MODES], true)) {
            throw new ValidationException(['mode' => $this->translator->trans('ramon-canela.api.ai.errors.invalid_mode')]);
        }

        if ($text === '' || mb_strlen($text) > self::MAX_TEXT) {
            throw new ValidationException(['text' => $this->translator->trans('ramon-canela.api.ai.errors.no_content')]);
        }

        $customPrompt = trim(mb_substr((string) ($body['customPrompt'] ?? ''), 0, 1000));

        if ($mode === 'custom_prompt' && $customPrompt === '') {
            throw new ValidationException(['customPrompt' => $this->translator->trans('ramon-canela.api.ai.errors.no_prompt')]);
        }

        $language = trim(mb_substr((string) ($body['language'] ?? ''), 0, 60));
        $context = trim(mb_substr((string) ($body['context'] ?? ''), 0, 300));
        $model = in_array($mode, HelperPrompts::FAST_MODES, true) ? $this->settings->fastModel() : $this->settings->mainModel();

        $this->gate->claim($actor);

        if ($mode === 'titles') {
            return $this->titles($actor, $model, $text);
        }

        if ($mode === 'tags') {
            return $this->tags($actor, $model, $text, (string) ($body['title'] ?? ''));
        }

        $llmRequest = new LlmRequest(
            $model,
            HelperPrompts::system($mode, $language, $customPrompt, $context),
            [['role' => 'user', 'content' => HelperPrompts::input($text)]],
            [],
            16000,
            'low',
        );

        return NdjsonStream::response(function (callable $write) use ($actor, $llmRequest): void {
            $result = $this->llm->make()->send($llmRequest, static fn (string $piece) => $write('delta', ['text' => $piece]));
            $this->usage->addTokens($actor, $result->inputTokens, $result->outputTokens);

            if ($result->refused()) {
                throw new LlmException('refused', 'Recusado pelo provedor.');
            }

            $write('result', ['text' => self::stripInputTags($result->text)]);
        }, function (\Throwable $error): string {
            return $error instanceof LlmException && $error->reason === 'refused'
                ? $this->errors->message('refused')
                : $this->errors->describe($error);
        });
    }

    private function titles(User $actor, string $model, string $text): ResponseInterface
    {
        $result = $this->complete($actor, new LlmRequest($model, HelperPrompts::system('titles'), [['role' => 'user', 'content' => HelperPrompts::input($text)]], [], 2048, 'low'));

        $titles = array_values(array_unique(array_filter(array_map(
            static fn (string $line): string => mb_substr(trim(trim((string) preg_replace('/^\s*(\d+[.)]|[-*•])\s*/u', '', $line)), "\"'“”"), 0, 200),
            preg_split('/\R/u', $result) ?: []
        ))));

        return new JsonResponse(['data' => ['titles' => array_slice($titles, 0, 5)]]);
    }

    private function tags(User $actor, string $model, string $text, string $title): ResponseInterface
    {
        $tagClass = 'Flarum\\Tags\\Tag';

        if (! $this->extensions->isEnabled('flarum-tags') || ! class_exists($tagClass)) {
            return new JsonResponse(['data' => ['tagIds' => []]]);
        }

        /** @var \Illuminate\Support\Collection<int, \Flarum\Tags\Tag> $tags */
        $tags = $tagClass::query()->whereVisibleTo($actor)->orderBy('position')->limit(300)->get();

        if ($tags->isEmpty()) {
            return new JsonResponse(['data' => ['tagIds' => []]]);
        }

        $lines = $tags->map(static function ($tag): string {
            $kind = $tag->position !== null ? ($tag->parent_id ? 'tag primária filha' : 'tag primária') : 'tag secundária';
            $description = trim((string) $tag->description);

            return sprintf('- id %d (%s): %s%s', $tag->id, $kind, $tag->name, $description !== '' ? ' — '.mb_substr($description, 0, 140) : '');
        })->implode("\n");

        $content = ($title !== '' ? 'Título: '.mb_substr($title, 0, 200)."\n\n" : '').$text;
        $result = $this->complete($actor, new LlmRequest($model, HelperPrompts::system('tags', '', '', "Lista:\n".$lines), [['role' => 'user', 'content' => HelperPrompts::input($content)]], [], 2048, 'low'));

        preg_match_all('/\d+/', $result, $matches);
        $valid = $tags->pluck('id')->map(static fn ($id): int => (int) $id)->all();
        $ids = array_values(array_unique(array_filter(array_map('intval', $matches[0]), static fn (int $id): bool => in_array($id, $valid, true))));

        return new JsonResponse(['data' => ['tagIds' => array_map('strval', array_slice($ids, 0, 4))]]);
    }

    private function complete(User $actor, LlmRequest $request): string
    {
        try {
            $result = $this->llm->make()->send($request);
        } catch (LlmException $error) {
            throw new ValidationException(['ai' => $this->errors->describe($error)]);
        }

        $this->usage->addTokens($actor, $result->inputTokens, $result->outputTokens);

        return $result->text;
    }

    /** Às vezes o modelo devolve o texto ainda dentro das tags; elas não são do texto. */
    private static function stripInputTags(string $text): string
    {
        return trim((string) preg_replace('#^\s*<input>\s*|\s*</input>\s*$#', '', $text));
    }
}
