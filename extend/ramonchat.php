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
 * Os recursos de chat que o chat próprio do tema tinha e o
 * ramon/chat não tem, postos por cima dele — sem editar a extensão: os avisos
 * no sino, a MD consigo mesmo, o nome do chat em grupo, o limite de
 * participantes, a recusa de MD com quem não usa o chat, a limpeza dos canais
 * da tag apagada, o auto-join, o "está digitando" sem websocket, o
 * `canRestore` das mensagens e as preferências do leitor. O resto mora no JS
 * (js/src/forum/thirdparty/ramonChat/features).
 *
 * Tudo dentro do `whenExtensionEnabled('ramon-chat')`: as classes `Ramon\Chat\*`
 * só existem com a extensão, e sem ela nada daqui é registrado.
 */

use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Ramon\Canela\RamonChat\Access\RenameChannelPolicy;
use Ramon\Canela\RamonChat\Api\RenameChannel;
use Ramon\Canela\RamonChat\Api\SelfChannel;
use Ramon\Canela\RamonChat\Api\TypingController;
use Ramon\Canela\RamonChat\Http\RamonChatMiddleware;
use Ramon\Canela\RamonChat\Listener\DeleteTagChannels;
use Ramon\Canela\RamonChat\Listener\NotifyChatActivity;
use Ramon\Canela\RamonChat\Notification\ChatMentionBlueprint;
use Ramon\Canela\RamonChat\Notification\ChatMessageBlueprint;
use Ramon\Canela\RamonChat\RamonChatSettings;
use Ramon\Chat\Api\Resource\ChannelResource;
use Ramon\Chat\Api\Resource\MessageResource;
use Ramon\Chat\Channel;
use Ramon\Chat\Event\MessageWasSent;
use Ramon\Chat\Message;

return (static function (): array {
    $settings = (new Extend\Settings())
        ->default(RamonChatSettings::MASTER, true)
        ->default(RamonChatSettings::DM_MAX, RamonChatSettings::DM_MAX_CEILING);

    foreach (RamonChatSettings::FEATURES as $feature => $default) {
        $settings->default(RamonChatSettings::PREFIX.$feature, $default);
    }

    // Os valores aceitos de cada preferência de texto; o resto volta ao padrão.
    $oneOf = static fn (array $allowed, string $fallback) => static fn ($value) => in_array($value, $allowed, true) ? $value : $fallback;

    return [
        (new Extend\Conditional())->whenExtensionEnabled('ramon-chat', fn () => [
            $settings,

            (new Extend\ApiResource(ForumResource::class))
                ->fields(static fn (): array => [
                    Schema\Arr::make('canelaRamonChat')
                        ->get(static fn (): array => resolve(RamonChatSettings::class)->forumAttributes()),
                ]),

            // O botão "Restaurar" da mensagem excluída: a política `restore` do
            // ramon/chat já existe, só não ia para o cliente.
            (new Extend\ApiResource(MessageResource::class))
                ->fields(static fn (): array => [
                    Schema\Boolean::make('canRestore')
                        ->get(static fn (Message $message, Context $context): bool => $message->deleted_at !== null
                            && resolve(RamonChatSettings::class)->enabled('restore')
                            && $context->getActor()->can('restore', $message)),
                ]),

            // As preferências de chat que o ramon/chat não tem.
            (new Extend\User())
                ->registerPreference('canelaRamonChatHeaderIndicator', $oneOf(['all_new', 'dm_and_mentions', 'only_mentions', 'never'], 'all_new'), 'all_new')
                ->registerPreference('canelaRamonChatQuickReactions', $oneOf(['frequent', 'custom'], 'frequent'), 'frequent')
                ->registerPreference('canelaRamonChatQuickReactionsCustom', static fn ($value): string => is_string($value) ? mb_substr($value, 0, 120) : '', '')
                // Os canais com estrela: ids, no máximo 200.
                ->registerPreference('canelaRamonChatStarred', static fn ($value): array => is_array($value)
                    ? array_values(array_unique(array_filter(array_map('intval', array_slice($value, 0, 200)), static fn (int $id): bool => $id > 0)))
                    : [], []),

            // A MD consigo mesmo e o nome do chat em grupo: endpoints de ação no
            // recurso de canais do ramon/chat (`/api/chat-channels/...`).
            (new Extend\ApiResource(ChannelResource::class))
                ->endpoints(static fn (): array => [SelfChannel::endpoint(), RenameChannel::endpoint()]),

            (new Extend\Policy())
                ->modelPolicy(Channel::class, RenameChannelPolicy::class),

            // O "está digitando" sem websocket é uma consulta a cada poucos
            // segundos: fica um controller, que só confere a participação
            // (uma consulta indexada), sem a visibilidade inteira do canal.
            (new Extend\Routes('api'))
                ->get('/canela-ramon-chat/channels/{id:\d+}/typing', 'canela.ramonchat.typing', TypingController::class),

            (new Extend\Middleware('api'))->add(RamonChatMiddleware::class),

            (new Extend\Notification())
                ->type(ChatMentionBlueprint::class, ['alert'])
                ->type(ChatMessageBlueprint::class, ['alert']),

            (new Extend\Event())
                ->listen(MessageWasSent::class, NotifyChatActivity::class),

            (new Extend\Conditional())->whenExtensionEnabled('flarum-tags', fn () => [
                (new Extend\Event())->listen(\Flarum\Tags\Event\Deleting::class, DeleteTagChannels::class),
            ]),
        ]),
    ];
})();
