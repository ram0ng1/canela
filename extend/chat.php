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
use Flarum\Extend;
use Flarum\Foundation\Paths;
use Flarum\Http\UrlGenerator;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Ramon\Canela\Chat\Api;
use Ramon\Canela\Chat\ChatAccess;
use Ramon\Canela\Chat\ChatNotifier;
use Ramon\Canela\Chat\ChatSettings;
use Ramon\Canela\Chat\Console\PurgeChat;
use Ramon\Canela\Chat\Content\ChatPage;
use Ramon\Canela\Chat\Listener\DeleteTagChannels;
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

        (new Extend\Routes('api'))
            ->get('/chat/state', 'canela.chat.state', Api\StateController::class)
            ->get('/chat/channels', 'canela.chat.channels.index', Api\ChannelsController::class)
            ->post('/chat/channels', 'canela.chat.channels.create', Api\ChannelsController::class)
            ->get('/chat/channels/{id:\d+}', 'canela.chat.channels.show', Api\ChannelController::class)
            ->patch('/chat/channels/{id:\d+}', 'canela.chat.channels.update', Api\ChannelController::class)
            ->delete('/chat/channels/{id:\d+}', 'canela.chat.channels.delete', Api\ChannelController::class)
            ->post('/chat/channels/{id:\d+}/membership', 'canela.chat.membership.create', Api\MembershipController::class)
            ->patch('/chat/channels/{id:\d+}/membership', 'canela.chat.membership.update', Api\MembershipController::class)
            ->delete('/chat/channels/{id:\d+}/membership', 'canela.chat.membership.delete', Api\MembershipController::class)
            ->get('/chat/channels/{id:\d+}/members', 'canela.chat.members.index', Api\MembersController::class)
            ->post('/chat/channels/{id:\d+}/members', 'canela.chat.members.create', Api\MembersController::class)
            ->get('/chat/channels/{id:\d+}/messages', 'canela.chat.messages.index', Api\MessagesController::class)
            ->post('/chat/channels/{id:\d+}/messages', 'canela.chat.messages.create', Api\MessagesController::class)
            ->get('/chat/channels/{id:\d+}/updates', 'canela.chat.updates', Api\UpdatesController::class)
            ->post('/chat/channels/{id:\d+}/{action:read|typing|pins-read}', 'canela.chat.channels.action', Api\ChannelActionController::class)
            ->get('/chat/channels/{id:\d+}/{action:pins|threads}', 'canela.chat.channels.list', Api\ChannelActionController::class)
            ->get('/chat/messages/{id:\d+}', 'canela.chat.message.show', Api\MessageController::class)
            ->patch('/chat/messages/{id:\d+}', 'canela.chat.message.update', Api\MessageController::class)
            ->delete('/chat/messages/{id:\d+}', 'canela.chat.message.delete', Api\MessageController::class)
            ->post('/chat/messages/{id:\d+}/{action:restore|reactions|pin}', 'canela.chat.message.action', Api\MessageActionController::class)
            ->delete('/chat/messages/{id:\d+}/{action:pin}', 'canela.chat.message.unpin', Api\MessageActionController::class)
            ->get('/chat/threads', 'canela.chat.threads.mine', Api\UserThreadsController::class)
            ->get('/chat/threads/{id:\d+}', 'canela.chat.threads.show', Api\ThreadController::class)
            ->patch('/chat/threads/{id:\d+}', 'canela.chat.threads.update', Api\ThreadController::class)
            ->post('/chat/threads/{id:\d+}/{action:read}', 'canela.chat.threads.read', Api\ThreadController::class)
            ->post('/chat/direct-messages', 'canela.chat.direct', Api\DirectMessagesController::class)
            ->get('/chat/users', 'canela.chat.users', Api\UsersController::class)
            ->post('/chat/uploads', 'canela.chat.uploads', Api\UploadController::class)
            ->get('/chat/search', 'canela.chat.search', Api\SearchController::class),

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
