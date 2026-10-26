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
 * Subabas de "Atividade" do perfil que precisam do servidor: Lidos (só a
 * própria pessoa e administradores), Reações
 * (curtidas e reações do fof/reactions numa lista só) e Votos (fof/polls). "Resolvido" usa o filtro `solution`
 * do próprio fof/best-answer. Cada parte só existe com a extensão dela; as
 * abas ligam e desligam no card "Página de perfil" do admin.
 */

use Flarum\Api\Resource\ForumResource;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Post\Filter\PostSearcher;
use Flarum\Search\Database\DatabaseSearchDriver;
use Ramon\Canela\Activity\Api\ForumActivityFields;
use Ramon\Canela\Activity\Api\ListReactionsController;
use Ramon\Canela\Activity\Search\ReadByFilter;
use Ramon\Canela\Activity\Search\VotedByFilter;

return [
    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, ReadByFilter::class),

    (new Extend\ApiResource(ForumResource::class))
        ->fields(ForumActivityFields::class),

    (new Extend\Routes('api'))
        ->get('/canela-user-reactions', 'canela.activity.reactions', ListReactionsController::class),

    // As classes do fof só são citadas dentro das closures: com a extensão
    // desligada, nada disso é avaliado.
    (new Extend\Conditional())
        ->whenExtensionEnabled('fof-polls', fn () => [
            (new Extend\SearchDriver(DatabaseSearchDriver::class))
                ->addFilter(PostSearcher::class, VotedByFilter::class),
        ]),
];
