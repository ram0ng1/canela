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

namespace Ramon\Canela\Ai\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\TopicSummary;

/**
 * Os dados de IA de cada tópico:
 *
 * - `canelaAiGist`: o resumo curto da lista (só com os gists ligados);
 * - `canelaAiHasSummary`: há um resumo pronto — o botão "Resumir" aparece até
 *   para quem não pode gerar, porque ler um resumo pronto todos podem;
 * - `canelaAiSummarizable`: o tópico tem postagens bastantes para um resumo.
 *
 * Sem as tabelas criadas (antes do `migrate`), os campos nem aparecem.
 */
final class DiscussionAiFields
{
    public function __construct(
        private readonly AiSettings $settings,
    ) {
    }

    public function __invoke(): array
    {
        $summary = static fn (Discussion $discussion) => SummaryBuffer::defer($discussion->id);

        return [
            Schema\Str::make('canelaAiGist')
                ->nullable()
                ->visible(fn (): bool => $this->settings->feature(AiSettings::GISTS))
                ->get(static function (Discussion $discussion) use ($summary) {
                    $resolve = $summary($discussion);

                    return static fn (): ?string => $resolve()?->gist;
                }),

            Schema\Boolean::make('canelaAiHasSummary')
                ->visible(fn (): bool => $this->settings->feature(AiSettings::SUMMARY))
                ->get(static function (Discussion $discussion) use ($summary) {
                    $resolve = $summary($discussion);

                    return static function () use ($resolve): bool {
                        $found = $resolve();

                        return $found instanceof TopicSummary && (string) $found->summary !== '';
                    };
                }),

            Schema\Boolean::make('canelaAiSummarizable')
                ->visible(fn (): bool => $this->settings->feature(AiSettings::SUMMARY))
                ->get(fn (Discussion $discussion, Context $context): bool => (int) $discussion->comment_count >= $this->settings->int(AiSettings::SUMMARY_MIN_POSTS, 1, 1000)),
        ];
    }
}
