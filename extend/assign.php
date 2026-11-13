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
 * Atribuir tópico, como o assign do Discourse: um responsável por tópico
 * (canelaAssignee), a notificação para ele, a lista /assigned ("Atribuídos a
 * mim") e o registro no flarum/audit.
 */

use Flarum\Api\Endpoint;
use Flarum\Api\Context;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Discussion\Event\Started;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Posted;
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Search\Database\DatabaseSearchDriver;
use Flarum\User\User;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Ramon\Canela\Assign\Access\AssistantPolicy;
use Ramon\Canela\Assign\Assigned;
use Ramon\Canela\Assign\AssignedBlueprint;
use Ramon\Canela\Assign\AssignedFilter;
use Ramon\Canela\Assign\AssigneeFields;
use Ramon\Canela\Assign\AssistantBot;
use Ramon\Canela\Assign\AssistantQueue;
use Ramon\Canela\Assign\Console\SendPendingReplies;
use Ramon\Canela\Assign\CreateAssistantController;
use Ramon\Canela\System\Api\SystemUserPresenter;

return [
    (new Extend\Settings())
        ->default(AssigneeFields::ENABLED, false)
        ->default(AssistantBot::ON_ASSIGN, true)
        ->default(AssistantBot::AUTO, false)
        ->default(AssistantBot::AUTO_TAGS, '')
        ->default(AssistantBot::AUTO_MODE, 'first')
        ->default(AssistantBot::PERSONA, '')
        ->default(AssistantBot::LENGTH, 'medium')
        ->default(AssistantBot::INSTRUCTIONS, '')
        ->default(AssistantBot::MENTION, true)
        ->default(AssistantBot::QUOTE, true)
        ->default(AssistantBot::LIKE, false)
        ->default(AssistantBot::RENAME, false)
        ->default(AssistantBot::RETAG, false)
        ->default(AssistantBot::EXTERNAL, false)
        ->default(AssistantBot::EXTERNAL_SOURCES, AssistantBot::DEFAULT_EXTERNAL_SOURCES)
        ->default(AssistantBot::DELAY, 0)
        ->serializeToForum('canelaAssign', AssigneeFields::ENABLED, 'boolval'),

    // As permissões do assistente vêm do grupo oculto dele (o reCAPTCHA).
    (new Extend\User())
        ->permissionGroups(fn (User $user, array $groupIds): array => resolve(AssistantBot::class)->permissionGroups($user, $groupIds)),

    // Curtir, renomear e mudar tags, quando ligados, sem o assistente ser admin.
    (new Extend\Policy())
        ->modelPolicy(Discussion::class, AssistantPolicy::class)
        ->modelPolicy(Flarum\Tags\Tag::class, AssistantPolicy::class),

    (new Extend\Model(Discussion::class))
        ->belongsTo('canelaAssignee', User::class, 'canela_assignee_id'),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(AssigneeFields::class)
        ->endpoint([Endpoint\Index::class, Endpoint\Show::class, Endpoint\Update::class], fn ($endpoint) => $endpoint->addDefaultInclude(['canelaAssignee'])),

    // "Atribuídos a mim" na barra lateral só para quem atribui (a equipe).
    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canelaCanAssign')
                ->get(fn ($forum, Context $context) => resolve(AssigneeFields::class)->enabled() && $context->getActor()->hasPermission('discussion.canelaAssign')),
            // O assistente (ou null): a aba do admin e a sugestão no modal.
            Schema\Arr::make('canelaAssistant')
                ->nullable()
                ->get(function ($forum, Context $context) {
                    $bot = resolve(AssistantBot::class);
                    $shown = $context->getActor()->isAdmin() || (resolve(AssigneeFields::class)->enabled() && $bot->onAssign());
                    $user = $shown ? $bot->get() : null;

                    return $user ? resolve(SystemUserPresenter::class)->present($user) : null;
                }),
        ]),

    (new Extend\Routes('api'))
        ->post('/canela/assign-assistant', 'canela.assign_assistant.create', CreateAssistantController::class),

    // Atribuído ao assistente: ele responde no tópico, pela fila.
    (new Extend\Event())
        ->listen(Assigned::class, function (Assigned $event): void {
            $bot = resolve(AssistantBot::class);

            if ($event->assignee && $bot->is($event->assignee) && $bot->onAssign()) {
                resolve(AssistantQueue::class)->reply((int) $event->discussion->id, (int) $event->actor->id);
            }
        })
        // A resposta automática nas tags escolhidas. A abertura vem pelo
        // Started, que chega depois de o tópico ganhar as tags; as respostas,
        // pelo Posted (o Posted da primeira postagem chega antes das tags).
        ->listen(Started::class, function (Started $event): void {
            $post = $event->discussion->firstPost;

            if ($post instanceof CommentPost && resolve(AssistantBot::class)->replies($post)) {
                resolve(AssistantQueue::class)->reply((int) $event->discussion->id, (int) $post->user_id, (int) $post->id);
            }
        })
        ->listen(Posted::class, function (Posted $event): void {
            $post = $event->post;

            if ((int) $post->number > 1 && ($bot = resolve(AssistantBot::class))->autoMode() === 'all' && $bot->replies($post)) {
                resolve(AssistantQueue::class)->reply((int) $post->discussion_id, (int) $post->user_id, (int) $post->id);
            }
        }),

    // A espera antes de responder, na fila síncrona.
    (new Extend\Console())
        ->command(SendPendingReplies::class)
        ->schedule(SendPendingReplies::class, static fn (ScheduledEvent $event) => SendPendingReplies::schedule($event)),

    (new Extend\SearchDriver(DatabaseSearchDriver::class))
        ->addFilter(DiscussionSearcher::class, AssignedFilter::class),

    (new Extend\Notification())
        ->type(AssignedBlueprint::class, ['alert']),

    (new Extend\Frontend('forum'))
        ->route('/assigned', 'canela.assigned'),

    (new Extend\Conditional())
        ->whenExtensionEnabled('flarum-audit', fn () => [
            // Um dos dois por evento: o callback que devolve null não grava.
            (new \Flarum\Audit\Extend\Audit())
                ->listen(Assigned::class, 'discussion.assigned', fn (Assigned $e) => $e->assignee ? ['discussion_id' => $e->discussion->id, 'user_id' => $e->assignee->id] : null)
                ->listen(Assigned::class, 'discussion.unassigned', fn (Assigned $e) => $e->assignee ? null : ['discussion_id' => $e->discussion->id]),
        ]),
];
