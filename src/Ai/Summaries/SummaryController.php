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

namespace Ramon\Canela\Ai\Summaries;

use Flarum\Discussion\Discussion;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Ai\AiErrors;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Http\AiGate;
use Ramon\Canela\Ai\Http\NdjsonStream;
use Ramon\Canela\Ai\UsageLimiter;
use Ramon\Canela\Ai\Validation\SummaryValidator;

/**
 * `POST /api/canela/ai/summaries/{id}`: gera (ou atualiza) o resumo de IA de
 * um tópico, em streaming. Um resumo em dia volta na hora, sem chamar o
 * modelo; um desatualizado só é refeito com `regenerate` — abrir o painel não
 * gasta nada se já há resumo.
 *
 * Ler o resumo pronto é o recurso `canela-ai-summaries` (TopicSummaryResource).
 * Isto continua um controller por causa do streaming: a entrada passa pelo
 * SummaryValidator e a permissão `canela.generateAiSummaries` é conferida
 * antes dos cabeçalhos.
 */
final class SummaryController implements RequestHandlerInterface
{
    public function __construct(
        private readonly AiGate $gate,
        private readonly AiSettings $settings,
        private readonly TopicSummarizer $summarizer,
        private readonly UsageLimiter $usage,
        private readonly AiErrors $errors,
        private readonly SummaryValidator $validator,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->gate->feature(AiSettings::SUMMARY);

        $actor = RequestUtil::getActor($request);
        $discussion = Discussion::query()->whereVisibleTo($actor)->find(AiGate::routeId($request));

        if (! $discussion instanceof Discussion) {
            throw new RouteNotFoundException();
        }

        $body = AiGate::body($request);
        $this->validator->assertValid(['regenerate' => $body['regenerate'] ?? null]);

        $canGenerate = $actor->can(AiSettings::SUMMARIZE_PERMISSION);
        $summary = $this->summarizer->find($discussion);
        $present = $this->summarizer->present($discussion, $summary, $canGenerate);

        $regenerate = ! empty($body['regenerate']);

        if ($present !== null && (! $present['outdated'] || ! $regenerate)) {
            return NdjsonStream::response(static fn (callable $write) => $write('summary', ['summary' => $present]), $this->errors->describe(...));
        }

        $actor->assertCan(AiSettings::SUMMARIZE_PERMISSION);

        $this->gate->quota($actor);

        $minPosts = $this->settings->int(AiSettings::SUMMARY_MIN_POSTS, 1, 1000);

        if ((int) $discussion->comment_count < $minPosts) {
            throw new RouteNotFoundException();
        }

        $this->gate->claim($actor);

        return NdjsonStream::response(function (callable $write) use ($discussion, $actor, $canGenerate): void {
            $result = $this->summarizer->summarize($discussion, $actor, static fn (string $piece) => $write('delta', ['text' => $piece]));
            $this->usage->addTokens($actor, $result->inputTokens, $result->outputTokens);

            $write('summary', ['summary' => $this->summarizer->present($discussion, $this->summarizer->find($discussion), $canGenerate)]);
        }, $this->errors->describe(...));
    }
}
