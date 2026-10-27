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
 * O chat: canais públicos (avulsos ou de uma tag), mensagens
 * diretas 1:1 e em grupo, fios, reações, menções, fixadas, imagens, "está
 * digitando" e entrega em tempo real pelo flarum/realtime (com polling quando
 * ele não está disponível).
 *
 * Tudo fica registrado mesmo com o chat desligado no admin — as rotas são
 * montadas no boot, antes das configurações — e cada ponto de entrada consulta
 * `canela.chat_enabled` (ChatSettings): desligado, a API e as páginas
 * respondem 404 e o fórum não mostra nada.
 */

use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\UserResource;
use Flarum\Extend;
use Flarum\Foundation\Paths;
use Flarum\Http\UrlGenerator;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Ramon\Canela\Chat\Access\ChannelPolicy;
use Ramon\Canela\Chat\Access\MessagePolicy;
use Ramon\Canela\Chat\Access\ScopeChannelVisibility;
use Ramon\Canela\Chat\Access\ScopeMessageVisibility;
use Ramon\Canela\Chat\Access\ScopeThreadVisibility;
use Ramon\Canela\Chat\Access\ThreadPolicy;
use Ramon\Canela\Chat\Api;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatNotifier;
use Ramon\Canela\Chat\ChatServiceProvider;
use Ramon\Canela\Chat\ChatSettings;
use Ramon\Canela\Chat\Console\PurgeChat;
use Ramon\Canela\Chat\Content\ChatPage;
use Ramon\Canela\Chat\Http\MissingChatTables;
use Ramon\Canela\Chat\Listener\DeleteTagChannels;
use Ramon\Canela\Chat\Model\Channel;
use Ramon\Canela\Chat\Model\Message;
use Ramon\Canela\Chat\Model\Thread;
use Ramon\Canela\Chat\Notification\ChatMentionBlueprint;
use Ramon\Canela\Chat\Notification\ChatMessageBlueprint;
use Ramon\Canela\Chat\Upload\ChatUploads;

// Numa closure: o extend.php principal faz `require` deste arquivo, e uma
// variável daqui sobrescreveria as de lá.
return (static function (): array {
    $settings = new Extend\Settings();

    foreach (ChatSettings::DEFAULTS as $key => $default) {
        $settings->default($key, $default);
    }

    // Só o liga/desliga vai como configuração crua: o resto chega pelo
    // `canelaChat` do fórum, já resolvido para o ator.
    $settings->serializeToForum('canelaChatEnabled', ChatSettings::ENABLED, 'boolval');

    // Os valores aceitos de cada preferência de texto; o resto volta ao padrão.
    $oneOf = static fn (array $allowed, string $fallback) => static fn ($value) => in_array($value, $allowed, true) ? $value : $fallback;

    $page = ChatPage::class;

    return [
        $settings,

        (new Extend\ApiResource(ForumResource::class))
            ->fields(Api\ForumChatAttributes::class),

        // As preferências de chat (Configurações → Chat).
        (new Extend\User())
            ->registerPreference(ChatAccess::PREF_ENABLED, 'boolval', true)
            ->registerPreference(ChatNotifier::PREF_IGNORE_WIDE, 'boolval', false)
            ->registerPreference('canelaChatSound', $oneOf(['none', 'bell', 'ding'], 'none'), 'none')
            ->registerPreference('canelaChatSendShortcut', $oneOf(['enter', 'meta_enter'], 'enter'), 'enter')
            ->registerPreference('canelaChatHeaderIndicator', $oneOf(['all_new', 'dm_and_mentions', 'only_mentions', 'never'], 'all_new'), 'all_new')
            ->registerPreference('canelaChatQuickReactions', $oneOf(['frequent', 'custom'], 'frequent'), 'frequent')
            ->registerPreference('canelaChatQuickReactionsCustom', static fn ($value) => is_string($value) ? mb_substr($value, 0, 64) : '', '')
            ->registerPreference('canelaChatAnnounce', 'boolval', false),

        (new Extend\ServiceProvider())->register(ChatServiceProvider::class),

        // A API: canais, mensagens e fios como recursos JSON:API, com as
        // ações (participar, ler, reagir, fixar…) como endpoints deles. Só o
        // envio de imagem (multipart) continua controller.
        new Extend\ApiResource(Api\ChannelResource::class),
        new Extend\ApiResource(Api\MessageResource::class),
        new Extend\ApiResource(Api\ThreadResource::class),

        // A busca de pessoas do chat, no recurso `users` do core. Antes do
        // `show`: a rota fixa tem de vir antes da `/users/{id}`, senão é ela
        // que atende (com "canela-chat-search" como id).
        (new Extend\ApiResource(UserResource::class))
            ->endpointsBefore('show', static fn () => [Api\UserSearch::endpoint()]),

        (new Extend\Routes('api'))
            ->post('/chat/uploads', 'canela.chat.uploads', Api\UploadController::class),

        (new Extend\Middleware('api'))
            ->add(MissingChatTables::class),

        // Quem pode o quê: as permissões globais (canela.chat.*) moram em
        // `group_permission`; as de cada canal, mensagem e fio, nas policies.
        (new Extend\Policy())
            ->modelPolicy(Channel::class, ChannelPolicy::class)
            ->modelPolicy(Message::class, MessagePolicy::class)
            ->modelPolicy(Thread::class, ThreadPolicy::class),

        (new Extend\ModelVisibility(Channel::class))
            ->scope(ScopeChannelVisibility::class),

        (new Extend\ModelVisibility(Message::class))
            ->scope(ScopeMessageVisibility::class),

        (new Extend\ModelVisibility(Thread::class))
            ->scope(ScopeThreadVisibility::class),

        // As páginas do fórum: a página cheia e as sub-rotas
        // (/chat/c/:slug/:id, /chat/c/:slug/:id/t/:thread, /chat/browse…).
        (new Extend\Frontend('forum'))
            ->route('/chat', 'canela.chat', $page)
            ->route('/chat/browse', 'canela.chat.browse', $page)
            ->route('/chat/browse/{filter}', 'canela.chat.browse.filter', $page)
            ->route('/chat/new-message', 'canela.chat.new_message', $page)
            ->route('/chat/channels', 'canela.chat.channels', $page)
            ->route('/chat/direct-messages', 'canela.chat.direct_messages', $page)
            ->route('/chat/threads', 'canela.chat.threads', $page)
            ->route('/chat/search', 'canela.chat.search', $page)
            ->route('/chat/c/{slug}/{id:\d+}', 'canela.chat.channel', $page)
            ->route('/chat/c/{slug}/{id:\d+}/{rest:.+}', 'canela.chat.channel.sub', $page),

        (new Extend\Notification())
            ->type(ChatMentionBlueprint::class, ['alert'])
            ->type(ChatMessageBlueprint::class, ['alert']),

        (new Extend\Filesystem())
            ->disk(ChatUploads::DISK, static fn (Paths $paths, UrlGenerator $url): array => [
                'root' => "$paths->public/assets/canela-chat",
                'url' => $url->to('forum')->path('assets/canela-chat'),
            ]),

        (new Extend\Console())
            ->command(PurgeChat::class)
            ->schedule(PurgeChat::class, static fn (ScheduledEvent $event) => PurgeChat::schedule($event)),

        (new Extend\Conditional())
            ->whenExtensionEnabled('flarum-tags', fn () => [
                (new Extend\Event())->listen(\Flarum\Tags\Event\Deleting::class, DeleteTagChannels::class),
            ]),
    ];
})();
