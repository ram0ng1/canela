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
use Flarum\Api\Endpoint;
use Flarum\Api\Resource\AbstractDatabaseResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Ai\AiSettings;
use Ramon\Canela\Ai\Http\AiGate;
use Ramon\Canela\Ai\TopicSummary;
use Tobyz\JsonApiServer\Context as OriginalContext;

/**
 * `GET /api/canela-ai-summaries/{id}`: o resumo de IA pronto de um tópico (o
 * id é o do tópico), para quem não gera resumos ler o que já existe.
 *
 * - Qualquer um que veja o tópico, visitante incluído, lê o resumo: o escopo
 *   é a visibilidade do próprio tópico.
 * - Tópico sem resumo (só com o resumo curto da lista, ou nada) responde 404,
 *   como o tópico que a pessoa não vê.
 * - Com o resumo desligado, 404.
 *
 * Gerar e atualizar o resumo fica no `POST /api/canela/ai/summaries/{id}`
 * (SummaryController), porque a resposta vem em streaming.
 *
 * @extends AbstractDatabaseResource<TopicSummary>
 */
final class TopicSummaryResource extends AbstractDatabaseResource
{
    #[\Override]
    public function type(): string
    {
        return 'canela-ai-summaries';
    }

    #[\Override]
    public function model(): string
    {
        return TopicSummary::class;
    }

    #[\Override]
    public function scope(Builder $query, OriginalContext $context): void
    {
        $query
            ->whereIn('canela_ai_summaries.discussion_id', Discussion::query()->whereVisibleTo($context->getActor())->select('discussions.id'))
            ->whereNotNull('canela_ai_summaries.summary')
            ->where('canela_ai_summaries.summary', '!=', '');
    }

    #[\Override]
    public function endpoints(): array
    {
        return [
            Endpoint\Show::make()
                ->before(static fn () => resolve(AiGate::class)->feature(AiSettings::SUMMARY))
                ->eagerLoad('discussion'),
        ];
    }

    #[\Override]
    public function fields(): array
    {
        return [
            Schema\Str::make('text')
                ->get(static fn (TopicSummary $summary): string => (string) $summary->summary),
            Schema\DateTime::make('updatedAt')
                ->nullable()
                ->get(static fn (TopicSummary $summary) => $summary->summary_updated_at),
            Schema\Str::make('model')
                ->nullable()
                ->get(static fn (TopicSummary $summary): ?string => $summary->summary_model),
            // Desatualizado: chegaram postagens depois do resumo.
            Schema\Boolean::make('outdated')
                ->get(static fn (TopicSummary $summary): bool => self::outdated($summary)),
            Schema\Integer::make('newPostsSinceSummary')
                ->get(static fn (TopicSummary $summary): int => max(0, (int) $summary->discussion?->comment_count - (int) $summary->summary_post_count)),
            Schema\Boolean::make('canRegenerate')
                ->get(static fn (TopicSummary $summary, Context $context): bool => self::outdated($summary)
                    && $context->getActor()->can(AiSettings::SUMMARIZE_PERMISSION)),

            Schema\Relationship\ToOne::make('discussion')
                ->type('discussions')
                ->includable(),
        ];
    }

    private static function outdated(TopicSummary $summary): bool
    {
        return (int) $summary->discussion?->last_post_number > (int) $summary->summary_post_number;
    }
}
