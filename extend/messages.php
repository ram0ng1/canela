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
 * As mensagens sobre o flarum/messages: as caixas do perfil
 * (Últimos, Enviadas, Novo, Não lidos, Arquivo), o arquivo por pessoa, o
 * título da mensagem e o "sair da mensagem".
 *
 * O flarum/messages é opcional: tudo o que toca as classes dele fica dentro
 * do `whenExtensionEnabled`, e nada é registrado sem ele. As colunas novas
 * (migrations `*_messages_*`) são consultadas antes de cada uso
 * (MessagesSchema), então o recurso pode ser ligado antes da migração — só
 * fica sem arquivo e sem título até ela rodar. Com o tema ligado antes do
 * flarum/messages, as migrations não acham as tabelas dele: o
 * MessagesSchemaProvider (fora do Conditional, para ouvir o `Enabled` do
 * flarum/messages) instala o esquema quando ele chega.
 */

use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\UserResource;
use Flarum\Api\Schema;
use Flarum\Extend;
use Flarum\Forum\Content\User as UserContent;
use Flarum\Messages\Api\Resource\DialogMessageResource;
use Flarum\Messages\Api\Resource\DialogResource;
use Flarum\Messages\DialogMessage\Event\Created;
use Flarum\Messages\Search\DialogSearcher;
use Flarum\Search\Database\DatabaseSearchDriver;
use Flarum\Api\Context;
use Flarum\User\Event\GroupsChanged;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Messages\Api\DialogActions;
use Ramon\Canela\Messages\Api\DialogFields;
use Ramon\Canela\Messages\Api\DialogMessageFields;
use Ramon\Canela\Messages\Api\LeaveDialog;
use Ramon\Canela\Messages\Api\RecordDialogView;
use Ramon\Canela\Messages\Api\UserFields;
use Flarum\Messages\DialogMessage\Event\Creating;
use Ramon\Canela\Messages\Listener\ConvertToGroupConversation;
use Ramon\Canela\Messages\Listener\CreateGroupConversation;
use Ramon\Canela\Messages\Reactions\MessageReactedBlueprint;
use Ramon\Canela\Messages\Reactions\MessageReactions;
use Ramon\Canela\Messages\Reactions\ReactionEndpoints;
use Ramon\Canela\Messages\Reactions\ReactionFields;
use Ramon\Canela\Messages\Listener\MoveToInboxOnReply;
use Ramon\Canela\Messages\Listener\SyncGroupMembers;
use Ramon\Canela\Messages\MessagesSchema;
use Ramon\Canela\Messages\MessagesSchemaProvider;
use Ramon\Canela\Messages\Notification\SkipMutedDialogs;
use Ramon\Canela\Messages\StaffGroups;
use Ramon\Canela\Messages\Search\BoxFilter;

return [
    (new Extend\ServiceProvider())->register(MessagesSchemaProvider::class),

    (new Extend\Settings())
        ->default('canela.messages_enabled', true)
        ->serializeToForum('canelaMessagesEnabled', 'canela.messages_enabled', 'boolval'),

    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-messages', fn () => [
            // `/u/{username}/messages` já é atendida pela rota do perfil do
            // core (`/u/{username}[/{filter}]`); as caixas têm um nível a mais.
            (new Extend\Frontend('forum'))
                ->route('/u/{username}/messages/{box:sent|new|unread|archive|group}', 'canela.user.messages.box', UserContent::class),

            // Avisa o fórum de que as caixas e o arquivo existem: sem este
            // arquivo carregado, o JS mostra só o que o flarum/messages faz.
            (new Extend\ApiResource(ForumResource::class))
                ->fields(static fn (): array => [
                    Schema\Boolean::make('canelaMessagesBoxes')
                        ->get(static fn (): bool => true),
                    // A caixa da equipe: o grupo, se quem vê é dela, e alguém
                    // para receber a mensagem "à equipe" do seletor.
                    Schema\Arr::make('canelaMessageGroup')
                        ->visible(static fn ($forum, Context $context): bool => ! $context->getActor()->isGuest())
                        ->get(static function ($forum, Context $context): ?array {
                            $db = resolve(ConnectionInterface::class);

                            if (! MessagesSchema::hasGroups($db)) {
                                return null;
                            }

                            $staff = resolve(StaffGroups::class);
                            $actor = $context->getActor();

                            return [
                                'id' => $staff->inboxGroupId(),
                                'member' => StaffGroups::isStaff($actor),
                                'contactUserId' => $staff->contactFor($actor),
                            ];
                        }),
                    // As reações nas mensagens: se valem (a tabela existe), se
                    // a lista é a do fof/reactions e, sem ele, a padrão.
                    Schema\Arr::make('canelaMessageReactions')
                        ->visible(static fn ($forum, Context $context): bool => ! $context->getActor()->isGuest())
                        ->get(static function (): array {
                            $reactions = resolve(MessageReactions::class);

                            return [
                                'enabled' => $reactions->enabled(),
                                'fof' => $reactions->usesFof(),
                                'list' => $reactions->usesFof() ? [] : MessageReactions::DEFAULTS,
                            ];
                        }),
                ]),

            (new Extend\ApiResource(DialogResource::class))
                ->fields(DialogFields::class)
                ->endpoints(static fn (): array => [
                    LeaveDialog::endpoint(),
                    RecordDialogView::endpoint(),
                    DialogActions::inviteEndpoint(),
                    DialogActions::unreadEndpoint(),
                ]),

            (new Extend\ApiResource(DialogMessageResource::class))
                ->fields(DialogMessageFields::class)
                ->fields(ReactionFields::class)
                ->endpoints(static fn (): array => ReactionEndpoints::endpoints()),

            (new Extend\ApiResource(UserResource::class))
                ->fields(UserFields::class),

            (new Extend\SearchDriver(DatabaseSearchDriver::class))
                ->addFilter(DialogSearcher::class, BoxFilter::class),

            (new Extend\Event())
                ->listen(Created::class, MoveToInboxOnReply::class)
                ->listen(Creating::class, [ConvertToGroupConversation::class, 'creating'])
                ->listen(Created::class, ConvertToGroupConversation::class)
                ->listen(GroupsChanged::class, SyncGroupMembers::class)
                ->listen(Creating::class, CreateGroupConversation::class),

            (new Extend\Notification())
                ->type(MessageReactedBlueprint::class, ['alert'])
                ->beforeSending(SkipMutedDialogs::class),
        ]),
];
