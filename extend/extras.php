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
 * Recursos "extras": página de busca com filtros avançados,
 * seleção em massa, "Melhores" por período, tamanho do texto, banner de
 * anúncio, imprimir tópico e histórico de edições.
 *
 * Cada um liga e desliga no admin (`canela.*_enabled`, padrão ligado).
 * Desligado, o fórum não mostra nada dele e as rotas respondem 404.
 */

use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\PostResource;
use Flarum\Api\Sort\SortColumn;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Post\Event\Revised;
use Flarum\Post\Filter\PostSearcher;
use Flarum\Post\Post;
use Flarum\Search\Database\DatabaseSearchDriver;
use Ramon\Canela\Extras\Banner\BannerHtml;
use Ramon\Canela\Extras\Extras;
use Ramon\Canela\Extras\History\ListRevisionsController;
use Ramon\Canela\Extras\History\PostRevision;
use Ramon\Canela\Extras\History\PostRevisionFields;
use Ramon\Canela\Extras\History\RecordRevision;
use Ramon\Canela\Extras\Search\BookmarkedFilter;
use Ramon\Canela\Extras\Search\DiscussionSearchMutator;
use Ramon\Canela\Extras\Search\LikedFilter;
use Ramon\Canela\Extras\Search\MinPostsFilter;
use Ramon\Canela\Extras\Search\PostBookmarkedFilter;
use Ramon\Canela\Extras\Search\PostSearchMutator;
use Ramon\Canela\Extras\Search\SearchPageContent;
use Ramon\Canela\Extras\Search\SortsByLikes;

$settings = new Extend\Settings();

/*
 * chave => [atributo no fórum, padrão, conversão]. O texto do banner não vai
 * cru: sai como HTML pronto (BannerHtml), e o admin lê o texto das
 * configurações dele. O `serializeToForum` indexa pela chave, então cada chave
 * aparece uma vez só.
 */
foreach ([
    Extras::SEARCH_PAGE => ['canelaSearchPageEnabled', true, 'boolval'],
    Extras::BULK_SELECT => ['canelaBulkSelectEnabled', true, 'boolval'],
    Extras::TOP_PERIODS => ['canelaTopPeriodsEnabled', true, 'boolval'],
    Extras::TEXT_SIZE => ['canelaTextSizeEnabled', true, 'boolval'],
    Extras::BANNER => ['canelaBannerEnabled', true, 'boolval'],
    Extras::BANNER_TEXT => ['canelaBannerHtml', '', BannerHtml::class],
    Extras::BANNER_ID => ['canelaBannerId', '', null],
    Extras::PRINT_TOPIC => ['canelaPrintTopicEnabled', true, 'boolval'],
    Extras::POST_HISTORY => ['canelaPostHistoryEnabled', true, 'boolval'],
    Extras::POST_HISTORY_PUBLIC => ['canelaPostHistoryPublic', true, 'boolval'],
] as $key => [$attributeName, $default, $cast]) {
    $settings->default($key, $default)->serializeToForum($attributeName, $key, $cast);
}

return [
    $settings,

    // ── Página de busca ──────────────────────────────────────────────────────
    (new Extend\Frontend('forum'))
        ->route('/search', 'canela.search', SearchPageContent::class),

    // `min-posts:` e `in:title` valem para qualquer busca de tópicos (o modal
    // do core também os entende), não só para a página. "Marcados por mim" lê a
    // tabela do recurso de marcadores e não acha nada se ela não existir.
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, MinPostsFilter::class)
        ->addFilter(DiscussionSearcher::class, BookmarkedFilter::class)
        ->addFilter(PostSearcher::class, PostBookmarkedFilter::class)
        ->addMutator(DiscussionSearcher::class, DiscussionSearchMutator::class),

    // "Curtidos por mim" e "mais curtidos" dependem da tabela do flarum/likes.
    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-likes', fn () => [
            (new Extend\SearchDriver(DatabaseSearchDriver::class))
                ->addFilter(DiscussionSearcher::class, LikedFilter::class)
                ->addMutator(PostSearcher::class, PostSearchMutator::class),

            (new Extend\ApiResource(DiscussionResource::class))
                ->sorts(fn () => [SortColumn::make(SortsByLikes::SORT)]),

            (new Extend\ApiResource(PostResource::class))
                ->sorts(fn () => [SortColumn::make(SortsByLikes::SORT)]),
        ]),

    // ── Histórico de edições ─────────────────────────────────────────────────
    (new Extend\Model(Post::class))
        ->hasMany('canelaRevisions', PostRevision::class, 'post_id'),

    (new Extend\ApiResource(PostResource::class))
        ->fields(PostRevisionFields::class),

    (new Extend\Event())
        ->listen(Revised::class, RecordRevision::class),

    (new Extend\Routes('api'))
        ->get('/canela/posts/{id}/revisions', 'canela.posts.revisions', ListRevisionsController::class),
];
