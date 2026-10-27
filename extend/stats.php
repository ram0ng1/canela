<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * Estatísticas: visualizações de tópico, as contagens
 * "Novos (N)" e "Não lidos (N)" e a atividade do resumo do perfil (dias
 * visitados, tempo de leitura, postagens lidas, curtidas).
 *
 * Cada parte liga e desliga sozinha no admin. Desligada, o atributo some da
 * API e as rotas próprias respondem 404 — o fórum fica como se ela não
 * existisse, e os números já guardados continuam lá para quando voltar.
 */

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\UserResource;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Search\Database\DatabaseSearchDriver;
use Ramon\Canela\Stats\Api\Controller\RecordReadTimeController;
use Ramon\Canela\Stats\Api\DiscussionResourceFields;
use Ramon\Canela\Stats\Api\TopicMapFields;
use Ramon\Canela\Stats\Api\ForumResourceFields;
use Ramon\Canela\Stats\Api\RecordTopicView;
use Ramon\Canela\Stats\Api\ShowTopicCounts;
use Ramon\Canela\Stats\Api\ShowTopicViewStats;
use Ramon\Canela\Stats\Api\UserResourceFields;
use Ramon\Canela\Stats\Http\RecordVisitMiddleware;
use Ramon\Canela\Stats\Listener\BumpReadState;
use Ramon\Canela\Stats\Search\SortByViewsMutator;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\Search\NewFilter;
use Ramon\Canela\Stats\Search\UnreadFilter;

return [
    // `sort=-viewCount` também quando a listagem passa pelo buscador do core.
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addMutator(DiscussionSearcher::class, SortByViewsMutator::class),

    (new Extend\Settings())
        ->default(StatsSettings::VIEWS_ENABLED, true)
        ->serializeToForum('canelaStatsViewsEnabled', StatsSettings::VIEWS_ENABLED, 'boolval')
        ->default(StatsSettings::VIEW_WINDOW_HOURS, StatsSettings::DEFAULT_VIEW_WINDOW_HOURS)
        // As horas entram no texto do gráfico ("Uma visualização por visitante
        // exclusivo(a) a cada 8 horas"); as faixas, nas cores da coluna.
        ->serializeToForum('canelaStatsViewWindowHours', StatsSettings::VIEW_WINDOW_HOURS, 'intval')
        ->default(StatsSettings::HEAT_LOW, StatsSettings::DEFAULT_HEAT_LOW)
        ->serializeToForum('canelaTopicViewsHeatLow', StatsSettings::HEAT_LOW, 'intval')
        ->default(StatsSettings::HEAT_MEDIUM, StatsSettings::DEFAULT_HEAT_MEDIUM)
        ->serializeToForum('canelaTopicViewsHeatMedium', StatsSettings::HEAT_MEDIUM, 'intval')
        ->default(StatsSettings::HEAT_HIGH, StatsSettings::DEFAULT_HEAT_HIGH)
        ->serializeToForum('canelaTopicViewsHeatHigh', StatsSettings::HEAT_HIGH, 'intval')
        ->default(StatsSettings::COUNTS_ENABLED, true)
        ->serializeToForum('canelaStatsCountsEnabled', StatsSettings::COUNTS_ENABLED, 'boolval')
        ->default(StatsSettings::NEW_DAYS, StatsSettings::DEFAULT_NEW_DAYS)
        ->default(StatsSettings::ACTIVITY_ENABLED, true)
        ->serializeToForum('canelaStatsActivityEnabled', StatsSettings::ACTIVITY_ENABLED, 'boolval'),

    // Visualizações: o atributo, a ordenação, o gancho que conta ao abrir e
    // as visualizações por dia do gráfico do mapa do tópico.
    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(DiscussionResourceFields::class)
        ->fields(TopicMapFields::class)
        ->sorts([DiscussionResourceFields::class, 'sorts'])
        ->endpoints(static fn (): array => [ShowTopicViewStats::endpoint()])
        ->endpoint(Endpoint\Show::class, fn (Endpoint\Show $endpoint): Endpoint\Show => $endpoint->after(RecordTopicView::class)),

    // "Novos (N)" / "Não lidos (N)": os campos do fórum e a renovação deles
    // (`GET /api/forums/canela-counts`).
    (new Extend\ApiResource(ForumResource::class))
        ->fields(ForumResourceFields::class)
        ->endpoints(static fn (): array => [ShowTopicCounts::endpoint()]),

    // Resumo de atividade do perfil.
    (new Extend\ApiResource(UserResource::class))
        ->fields(UserResourceFields::class),

    // As abas "Novos" e "Não lidos" listam pela mesma regra das contagens.
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, NewFilter::class)
        ->addFilter(DiscussionSearcher::class, UnreadFilter::class),

    // O tempo de leitura chega por `keepalive`: um beacon, fora do JSON:API.
    (new Extend\Routes('api'))
        ->post('/canela-read-time', 'canela.stats.read_time', RecordReadTimeController::class),

    // O dia de visita conta tanto ao carregar a página quanto ao navegar só
    // pela API (a aba que ficou aberta de um dia para o outro).
    // Ler, marcar tudo como lido ou postar invalida as contagens em cache
    // (novos, não lidos e o ponto das categorias) daquela pessoa.
    (new Extend\Event())->subscribe(BumpReadState::class),

    (new Extend\Middleware('forum'))->add(RecordVisitMiddleware::class),
    (new Extend\Middleware('api'))->add(RecordVisitMiddleware::class),
];
