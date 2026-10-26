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
 * Emblemas e níveis de confiança.
 *
 * - Níveis 0–4 calculados pelos requisitos de cada nível (Promotion), com as
 *   estatísticas de leitura do tema quando existem.
 * - Os emblemas automáticos que o Flarum consegue
 *   detectar (SystemBadges), concedidos por eventos e por `canela:badges`,
 *   agendado uma vez por dia.
 * - API `canela-badges` e `canela-user-badges`, a notificação "Ganhou …" e as páginas
 *   /badges e /badges/:id/:slug.
 */

use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Event\UserRead;
use Flarum\Extend;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Flarum\Search\Database\DatabaseSearchDriver;
use Flarum\User\Event\AvatarChanged;
use Flarum\User\Event\Saving;
use Flarum\User\User;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Database\Eloquent\Builder;
use Ramon\Canela\Badges\Api\BadgeResource;
use Ramon\Canela\Badges\Badge;
use Ramon\Canela\Badges\Api\UserBadgeResource;
use Ramon\Canela\Badges\Api\UserResourceFields;
use Ramon\Canela\Badges\BadgeSettings;
use Ramon\Canela\Badges\BadgesServiceProvider;
use Ramon\Canela\Badges\Capabilities;
use Ramon\Canela\Badges\Console\BadgesCommand;
use Ramon\Canela\Badges\Http\BadgesPageContent;
use Ramon\Canela\Badges\Listener\FlagListener;
use Ramon\Canela\Badges\Listener\LikeListener;
use Ramon\Canela\Badges\Listener\PostListener;
use Ramon\Canela\Badges\Listener\ReadListener;
use Ramon\Canela\Badges\Listener\UserListener;
use Ramon\Canela\Badges\Notification\BadgeGrantedBlueprint;
use Ramon\Canela\Badges\Search\BadgeFilter;
use Ramon\Canela\Badges\Search\UserBadgeSearcher;
use Ramon\Canela\Badges\Search\UserFilter;
use Ramon\Canela\Badges\UserBadge;

$settings = (new Extend\Settings())
    ->default(BadgeSettings::BADGES_ENABLED, true)
    ->serializeToForum('canelaBadgesEnabled', BadgeSettings::BADGES_ENABLED, 'boolval')
    ->default(BadgeSettings::TRUST_LEVELS_ENABLED, true)
    ->serializeToForum('canelaTrustLevelsEnabled', BadgeSettings::TRUST_LEVELS_ENABLED, 'boolval')
    ->default(BadgeSettings::USER_CARD, true)
    ->serializeToForum('canelaBadgesUserCard', BadgeSettings::USER_CARD, 'boolval')
    ->default(BadgeSettings::SUMMARY, true)
    ->serializeToForum('canelaBadgesSummary', BadgeSettings::SUMMARY, 'boolval')
    ->default(BadgeSettings::MAX_LIKES_PER_DAY, 50);

// Os requisitos dos níveis só interessam ao servidor e ao admin (que lê as
// configurações direto): não vão no payload do fórum.
foreach (BadgeSettings::REQUIREMENTS as $name => $default) {
    $settings->default(BadgeSettings::requirementKey($name), $default);
}

return [
    $settings,

    (new Extend\ServiceProvider())
        ->register(BadgesServiceProvider::class),

    (new Extend\Model(User::class))
        ->cast('canela_trust_level', 'integer')
        ->cast('canela_trust_level_locked', 'boolean')
        ->cast('canela_trust_level_at', 'datetime')
        ->hasMany('canelaUserBadges', UserBadge::class, 'user_id'),

    new Extend\ApiResource(BadgeResource::class),

    // Emblema desligado fica oculto para quem não é admin em toda consulta
    // com visibilidade — inclusive na notificação "Ganhou …", que o core
    // filtra pela visibilidade do assunto.
    (new Extend\ModelVisibility(Badge::class))
        ->scope(static function (User $actor, Builder $query): void {
            if (! $actor->isAdmin()) {
                $query->where('canela_badges.enabled', true);
            }
        }),

    new Extend\ApiResource(UserBadgeResource::class),

    (new Extend\ApiResource(UserResource::class))
        ->fields(UserResourceFields::class),

    // O que este fórum consegue medir, para o admin explicar de onde vem cada
    // requisito (estatísticas do tema ou o que o core guarda).
    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Arr::make('canelaBadgesCapabilities')
                ->visible(fn (object $forum, Context $context) => $context->getActor()->isAdmin())
                ->get(fn () => resolve(Capabilities::class)->summary()),
        ]),

    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addSearcher(UserBadge::class, UserBadgeSearcher::class)
        ->addFilter(UserBadgeSearcher::class, UserFilter::class)
        ->addFilter(UserBadgeSearcher::class, BadgeFilter::class),

    // Só com as tabelas criadas: o core consulta a tabela do assunto (os
    // emblemas) ao contar as notificações de quem está logado, e sem ela toda
    // página daria erro. A marca é uma configuração (gravada pela migração),
    // que o Flarum já carrega — nenhuma consulta a mais por requisição.
    (new Extend\Conditional())
        ->whenSetting(BadgeSettings::SCHEMA_INSTALLED, '1', fn () => [
            (new Extend\Notification())
                ->type(BadgeGrantedBlueprint::class, ['alert']),
        ]),

    // Com o fof/badges, `/badges` é dele: as páginas do tema mudam para
    // `/achievements` (o mesmo prefixo do JS, BADGES_ALT_PREFIX em
    // features/badges/routes.ts), em vez de sumirem.
    (new Extend\Conditional())
        ->whenExtensionDisabled('fof-badges', fn () => [
            (new Extend\Frontend('forum'))
                ->route('/badges', 'canela.badges', BadgesPageContent::class)
                ->route('/badges/{id:\d+}[/{slug}]', 'canela.badge', BadgesPageContent::class),
        ])
        ->whenExtensionEnabled('fof-badges', fn () => [
            (new Extend\Frontend('forum'))
                ->route('/achievements', 'canela.badges', BadgesPageContent::class)
                ->route('/achievements/{id:\d+}[/{slug}]', 'canela.badge', BadgesPageContent::class),
        ]),

    (new Extend\Event())
        ->listen(Posted::class, [PostListener::class, 'posted'])
        ->listen(Revised::class, [PostListener::class, 'revised'])
        ->listen(UserRead::class, ReadListener::class)
        ->listen(Saving::class, [UserListener::class, 'saving'])
        ->listen(AvatarChanged::class, [UserListener::class, 'avatarChanged']),

    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-likes', fn () => [
            (new Extend\Event())->listen('Flarum\Likes\Event\PostWasLiked', LikeListener::class),
        ])
        ->whenExtensionEnabled('flarum-flags', fn () => [
            (new Extend\Event())->listen('Flarum\Flags\Event\Created', FlagListener::class),
        ])
        ->whenExtensionEnabled('flarum-approval', fn () => [
            (new Extend\Event())->listen('Flarum\Approval\Event\PostWasApproved', [PostListener::class, 'approved']),
        ]),

    (new Extend\Console())
        ->command(BadgesCommand::class)
        ->schedule(BadgesCommand::class, static function (Event $event): void {
            $event->dailyAt('03:30')->withoutOverlapping();
        }),
];
