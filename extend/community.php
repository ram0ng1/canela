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

/*
 * Páginas de comunidade do Discourse: Sobre (/about), Usuários (/u) e
 * Grupos (/g e /g/:nome).
 */

use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\GroupResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Ramon\Canela\Community\Api\GroupFields;
use Ramon\Canela\Community\Api\ListDirectoryController;
use Ramon\Canela\Community\Api\ListGroupActivityController;
use Ramon\Canela\Community\Api\ShowAboutController;
use Ramon\Canela\Community\Api\ShowGuidelinesController;
use Ramon\Canela\Community\Community;
use Ramon\Canela\Community\Content\CommunityPage;
use Ramon\Canela\Community\Http\LegalPageRedirect;
use Ramon\Canela\Community\LegalPages;

/*
 * Nada de variáveis soltas aqui: o extend.php principal faz `require` deste
 * arquivo no próprio escopo, e um `$settings` daqui sobrescreveria o dele.
 */
return [
    // O texto "sobre", o contato e as opções da página não vão no payload do
    // fórum: só a página "Sobre" os usa, e ela os recebe do próprio endpoint.
    (new Extend\Settings())
        ->default(Community::ABOUT_ENABLED, true)
        ->serializeToForum('canelaAboutEnabled', Community::ABOUT_ENABLED, 'boolval')
        ->default(Community::ABOUT_TEXT, '')
        ->default(Community::ABOUT_CONTACT_EMAIL, '')
        ->default(Community::ABOUT_CONTACT_URL, '')
        ->default(Community::ABOUT_SHOW_STAFF, true)
        ->default(Community::ABOUT_SHOW_STATS, true)
        // Diretrizes, Termos e Privacidade (as abas do Sobre do Discourse).
        ->default(Community::GUIDELINES_ENABLED, true)
        ->serializeToForum('canelaGuidelinesEnabled', Community::GUIDELINES_ENABLED, 'boolval')
        ->default(Community::GUIDELINES_TEXT, '')
        ->default(Community::TOS_URL, '')
        ->default(Community::PRIVACY_URL, '')
        ->default(Community::DIRECTORY_ENABLED, true)
        ->serializeToForum('canelaDirectoryEnabled', Community::DIRECTORY_ENABLED, 'boolval')
        // Padrão desligado: o core só deixa membros listarem usuários, e abrir a
        // lista a visitantes é decisão do admin.
        ->default(Community::DIRECTORY_GUESTS, false)
        ->default(Community::GROUPS_ENABLED, true)
        ->serializeToForum('canelaGroupsEnabled', Community::GROUPS_ENABLED, 'boolval')
        ->default(Community::GROUPS_ACTIVITY, true)
        ->serializeToForum('canelaGroupsActivity', Community::GROUPS_ACTIVITY, 'boolval')
        ->default(Community::GROUPS_PROFILE_LINKS, true)
        ->serializeToForum('canelaGroupsProfileLinks', Community::GROUPS_PROFILE_LINKS, 'boolval'),

    (new Extend\Routes('api'))
        ->get('/canela-about', 'canela.about', ShowAboutController::class)
        ->get('/canela-guidelines', 'canela.guidelines', ShowGuidelinesController::class)
        ->get('/canela-directory', 'canela.directory', ListDirectoryController::class)
        ->get('/canela-groups/{id:\d+}/activity', 'canela.groups.activity', ListGroupActivityController::class),

    (new Extend\Frontend('forum'))
        ->route('/about', 'canela.about', CommunityPage::for(Community::ABOUT_ENABLED, 'about.title'))
        ->route('/guidelines', 'canela.guidelines', CommunityPage::for(Community::GUIDELINES_ENABLED, 'guidelines.title'))
        ->route('/faq', 'canela.faq', CommunityPage::for(Community::GUIDELINES_ENABLED, 'guidelines.title'))
        ->route('/u', 'canela.users', CommunityPage::for(Community::DIRECTORY_ENABLED, 'users.title'))
        ->route('/g', 'canela.groups', CommunityPage::for(Community::GROUPS_ENABLED, 'groups.title'))
        ->route('/g/{name}', 'canela.group', CommunityPage::for(Community::GROUPS_ENABLED, 'groups.title')),

    // /tos e /privacy levam ao endereço da política (fof/terms ou admin).
    (new Extend\Routes('forum'))
        ->get('/{page:tos|privacy}', 'canela.legal', LegalPageRedirect::class),

    // Se o ator pode abrir o diretório e as listas de membros — o fórum usa
    // para esconder o link "Usuários" em vez de levar a um 403.
    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canelaCanViewDirectory')
                ->get(fn (object $model, Context $context) => resolve(Community::class)->canListUsers($context->getActor())),
            // As abas de Termos/Privacidade (e outras políticas) com endereço.
            Schema\Arr::make('canelaLegalPages')
                ->get(fn () => resolve(LegalPages::class)->all()),
        ]),

    (new Extend\ApiResource(GroupResource::class))
        ->fields(GroupFields::class),
];
