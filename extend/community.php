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
use Flarum\Group\Event\Deleted as GroupDeleted;
use Flarum\Settings\Event\Saving;
use Flarum\User\Event\Deleted as UserDeleted;
use Flarum\User\Event\GroupsChanged;
use Flarum\User\Event\Registered as UserRegistered;
use Illuminate\Contracts\Cache\Repository as Cache;
use Ramon\Canela\Community\AboutPages;
use Ramon\Canela\Community\Api\ShowAboutPageController;
use Ramon\Canela\Community\Content\AboutPageContent;
use Ramon\Canela\Community\Api\CreateGuidelinesPageController;
use Ramon\Canela\Community\Api\GroupFields;
use Ramon\Canela\Community\Api\ListDirectoryController;
use Ramon\Canela\Community\Api\ListGroupActivityController;
use Ramon\Canela\Community\Api\ShowAboutController;
use Ramon\Canela\Community\Api\ShowGuidelinesController;
use Ramon\Canela\Community\Community;
use Ramon\Canela\Community\GuidelinesPage;
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
        // Desligadas por padrão, e ligadas só aparecem com conteúdo (o texto ou
        // uma página do fof/pages): sem isso, nada de aba, link ou /guidelines.
        ->default(Community::GUIDELINES_ENABLED, false)
        ->serializeToForum(
            'canelaGuidelinesEnabled',
            Community::GUIDELINES_ENABLED,
            static fn (mixed $enabled): bool => (bool) $enabled && resolve(GuidelinesPage::class)->hasContent()
        )
        ->default(Community::GUIDELINES_TEXT, '')
        ->default(Community::ABOUT_PAGES, '[]')
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
        ->post('/canela-guidelines/page', 'canela.guidelines.page', CreateGuidelinesPageController::class)
        ->get('/canela-about-pages/{id:\d+}', 'canela.about_pages.show', ShowAboutPageController::class)
        ->get('/canela-directory', 'canela.directory', ListDirectoryController::class)
        ->get('/canela-groups/{id:\d+}/activity', 'canela.groups.activity', ListGroupActivityController::class),

    (new Extend\Frontend('forum'))
        ->route('/about', 'canela.about', CommunityPage::for(Community::ABOUT_ENABLED, 'about.title'))
        ->route('/guidelines', 'canela.guidelines', CommunityPage::for(Community::GUIDELINES_ENABLED, 'guidelines.title'))
        ->route('/faq', 'canela.faq', CommunityPage::for(Community::GUIDELINES_ENABLED, 'guidelines.title'))
        // As abas extras da área Sobre (páginas do fof/pages escolhidas no admin),
        // com o id na frente como o /d/{id} do core. Não colide com o /p/{id} e o
        // /pages/home do fof/pages.
        ->route('/about/{page:\d+(?:-[^/]*)?}', 'canela.about_page', AboutPageContent::class)
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
            // As abas extras da área Sobre que o ator pode ver (vazio sem o fof/pages).
            Schema\Arr::make('canelaAboutPages')
                ->get(fn (object $model, Context $context) => resolve(AboutPages::class)->forForum($context->getActor())),
        ]),

    // A lista de abas extras chega do admin como JSON: guarda só ids inteiros
    // e únicos (até AboutPages::MAX), rótulos curtos e ícones válidos.
    (new Extend\Event())
        ->listen(Saving::class, static function (Saving $event): void {
            if (array_key_exists(Community::ABOUT_PAGES, $event->settings)) {
                $event->settings[Community::ABOUT_PAGES] = AboutPages::normalize($event->settings[Community::ABOUT_PAGES]);
            }
        })
        // A contagem de membros dos grupos (GroupFields) fica no cache: sai
        // quando alguém entra ou sai de um grupo, ou quando uma conta ou um
        // grupo é apagado.
        ->listen(GroupsChanged::class, static fn () => resolve(Cache::class)->forget(GroupFields::CACHE_KEY))
        ->listen(UserRegistered::class, static fn () => resolve(Cache::class)->forget(GroupFields::CACHE_KEY))
        ->listen(UserDeleted::class, static fn () => resolve(Cache::class)->forget(GroupFields::CACHE_KEY))
        ->listen(GroupDeleted::class, static fn () => resolve(Cache::class)->forget(GroupFields::CACHE_KEY)),

    (new Extend\ApiResource(GroupResource::class))
        ->fields(GroupFields::class),
];
