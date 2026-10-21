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

namespace Ramon\Canela\Stats\Api;

use Carbon\Carbon;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Discussion\Discussion;
use Flarum\Http\Exception\RouteNotFoundException;
use Laminas\Diactoros\Response\JsonResponse;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\TopicViewStats;

/**
 * `GET /api/discussions/{id}/canela-views?filter[days]=30`: as visualizações
 * por dia do tópico, para o gráfico "Visualizações recentes" do mapa do tópico.
 *
 * O período vai em `filter[days]`, e não num `?days=` solto, porque a API do
 * Flarum recusa (400) qualquer parâmetro só de letras minúsculas fora dos do
 * JSON:API (`include`, `fields`, `filter`, `page`, `sort`).
 *
 * A resposta tem o formato `{topic_id, stats: [{viewed_at, views}]}`, e o
 * período padrão é o dos últimos 30 dias até hoje.
 *
 * O `{id}` passa pela busca do próprio recurso de discussões, que aplica a
 * visibilidade de quem pede: um tópico que a pessoa não pode ver responde 404.
 */
final class ShowTopicViewStats
{
    private const DEFAULT_DAYS = 30;

    private const MAX_DAYS = 365;

    public static function endpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.viewStats')
            ->route('GET', '/{id}/canela-views')
            ->action(static function (Context $context): array {
                /** @var StatsSettings $settings */
                $settings = resolve(StatsSettings::class);

                // Desligado, a rota "não existe", como o resto do recurso.
                if (! $settings->viewsEnabled()) {
                    throw new RouteNotFoundException();
                }

                /** @var Discussion $discussion */
                $discussion = $context->model;

                $filter = $context->request->getQueryParams()['filter'] ?? [];
                $days = self::days(is_array($filter) ? ($filter['days'] ?? null) : null);
                $to = Carbon::now();
                $from = $to->copy()->subDays($days);

                return [
                    'topic_id' => (int) $discussion->id,
                    'stats' => resolve(TopicViewStats::class)->forDiscussion((int) $discussion->id, $from, $to),
                ];
            })
            ->response(static fn (Context $context, array $result): JsonResponse => new JsonResponse($result));
    }

    /** Entre 1 e 365 dias; qualquer coisa fora disso vira o padrão (30). */
    private static function days(mixed $value): int
    {
        if (! is_numeric($value)) {
            return self::DEFAULT_DAYS;
        }

        $days = (int) $value;

        return $days >= 1 && $days <= self::MAX_DAYS ? $days : self::DEFAULT_DAYS;
    }
}
