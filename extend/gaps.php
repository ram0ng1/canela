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
 * O backend dos recursos que faltavam (gaps):
 *
 * - notificações "editou sua postagem" e "vinculou seu tópico";
 * - o ponto de novidades por categoria na barra lateral (canelaHasUnread);
 * - datas locais [date=…] no formatador;
 * - links de convite (gerar, listar, apagar, o link /invites/{código} e o
 *   resgate no cadastro), com a notificação "aceitou seu convite";
 * - a página 404 do tema (a view de erro do core, sobreposta).
 *
 * Acompanhar/silenciar categorias, ignorar usuários e mover/dividir/mesclar
 * tópicos ficam com fof/follow-tags, fof/ignore-users, fof/split e
 * fof/merge-discussions; o tema só dá o visual. Tabelas em markdown são o
 * PipeTables do fof/formatting.
 *
 * Cada ponto de entrada consulta a própria chave (GapsSettings): desligada, a
 * rota responde 404, o campo some e a notificação não sai.
 */

use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\UserResource;
use Flarum\Extend;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Ramon\Canela\Gaps\Api\ForumResourceFields;
use Ramon\Canela\Gaps\Api\TagResourceFields;
use Ramon\Canela\Gaps\Formatter\LocalDates;
use Ramon\Canela\Gaps\GapsServiceProvider;
use Ramon\Canela\Gaps\GapsSettings;
use Ramon\Canela\Gaps\Invites\Access\InvitePolicy;
use Ramon\Canela\Gaps\Invites\Access\ScopeInviteVisibility;
use Ramon\Canela\Gaps\Invites\Api\InviteResource;
use Ramon\Canela\Gaps\Invites\Http\InviteInfoController;
use Ramon\Canela\Gaps\Invites\Invite;
use Ramon\Canela\Gaps\Invites\Http\RedeemInviteController;
use Ramon\Canela\Gaps\Invites\UserResourceFields;
use Ramon\Canela\Gaps\Listener\NotifyInviteAccepted;
use Ramon\Canela\Gaps\Listener\NotifyPostEdited;
use Ramon\Canela\Gaps\Listener\NotifyTopicLinked;
use Ramon\Canela\Gaps\Notification\InviteAcceptedBlueprint;
use Ramon\Canela\Gaps\Notification\PostEditedBlueprint;
use Ramon\Canela\Gaps\Notification\TopicLinkedBlueprint;

$settings = (new Extend\Settings())
    // O fórum só mostra a parte dos recursos que depende do servidor quando
    // este arquivo está carregado: o atributo é a prova disso.
    ->default('canela.gaps_backend', true)
    ->serializeToForum('canelaGapsBackend', 'canela.gaps_backend', fn () => true);

foreach (GapsSettings::DEFAULTS as $key => $default) {
    $settings->default($key, $default);
}

$settings
    ->serializeToForum('canelaNotifyPostEdited', GapsSettings::POST_EDITED, 'boolval')
    ->serializeToForum('canelaNotifyTopicLinked', GapsSettings::TOPIC_LINKED, 'boolval')
    ->serializeToForum('canelaInvitesEnabled', GapsSettings::INVITES, 'boolval');
// As datas locais saem do formatador (servidor): o JS do fórum não lê a
// configuração, e o admin a lê de app.data.settings.

$extenders = [
    $settings,

    (new Extend\ServiceProvider())->register(GapsServiceProvider::class),

    // Notificações. Só o alerta, ligado por padrão; cada pessoa desliga em
    // Configurações → Notificações.
    (new Extend\Notification())
        ->type(PostEditedBlueprint::class, ['alert'])
        ->type(TopicLinkedBlueprint::class, ['alert'])
        ->type(InviteAcceptedBlueprint::class, ['alert']),

    (new Extend\Event())
        ->listen(Revised::class, NotifyPostEdited::class)
        ->listen(Posted::class, NotifyTopicLinked::class)
        ->listen(Revised::class, NotifyTopicLinked::class)
        // O aviso do convite aceito espera a conta ser ativada.
        ->subscribe(NotifyInviteAccepted::class),

    // Datas locais. O formatador é montado uma vez e guardado em cache; a
    // chave liga/desliga só vale depois de limpar o cache.
    (new Extend\Formatter())
        ->configure(function (s9e\TextFormatter\Configurator $config): void {
            if (resolve(GapsSettings::class)->on(GapsSettings::LOCAL_DATES)) {
                (new LocalDates())($config);
            }
        }),

    // Convites.
    (new Extend\ApiResource(ForumResource::class))
        ->fields(ForumResourceFields::class),

    (new Extend\ApiResource(UserResource::class))
        ->fields(UserResourceFields::class),

    // Gerar, listar e apagar: o recurso JSON:API, com o escopo do dono e a
    // policy. A informação pública do código continua um controlador: ela
    // responde por códigos que não existem (`valid: false`), sem modelo.
    new Extend\ApiResource(InviteResource::class),

    (new Extend\ModelVisibility(Invite::class))
        ->scope(ScopeInviteVisibility::class),

    (new Extend\Policy())
        ->modelPolicy(Invite::class, InvitePolicy::class),

    (new Extend\Routes('api'))
        ->get('/canela-invite-info/{code:[A-Za-z0-9]+}', 'canela.invites.info', InviteInfoController::class),

    (new Extend\Routes('forum'))
        ->get('/invites/{code:[A-Za-z0-9]+}', 'canela.invite', RedeemInviteController::class),

    // A página 404 do tema: a view de erro do core, sobreposta.
    (new Extend\View())
        ->namespace('ramon-canela-gaps', __DIR__.'/../views/gaps')
        ->extendNamespace('flarum.forum', __DIR__.'/../views/override'),
];

// O ponto de novidades por categoria só existe com o flarum/tags habilitado
// (instalado mas desabilitado, o ApiResource registraria as rotas /api/tags).
$extenders[] = (new Extend\Conditional())
    ->whenExtensionEnabled('flarum-tags', fn () => [
        (new Extend\ApiResource(Flarum\Tags\Api\Resource\TagResource::class))
            ->fields(TagResourceFields::class),
    ]);

return $extenders;
