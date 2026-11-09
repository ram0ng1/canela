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
use Flarum\Discussion\Search\DiscussionSearcher;
use Flarum\Extend;
use Flarum\Search\Database\DatabaseSearchDriver;
use Flarum\User\User;
use Illuminate\Contracts\Queue\Queue;
use Ramon\Canela\Assign\Assigned;
use Ramon\Canela\Assign\AssignedBlueprint;
use Ramon\Canela\Assign\AssignedFilter;
use Ramon\Canela\Assign\AssigneeFields;
use Ramon\Canela\Assign\AssistantBot;
use Ramon\Canela\Assign\AssistantReplyJob;
use Ramon\Canela\Assign\CreateAssistantController;
use Ramon\Canela\System\Api\SystemUserPresenter;

return [
    (new Extend\Settings())
        ->default(AssigneeFields::ENABLED, false)
        ->serializeToForum('canelaAssign', AssigneeFields::ENABLED, 'boolval'),

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
            // O assistente (ou null): o card do admin e a sugestão no modal.
            Schema\Arr::make('canelaAssistant')
                ->nullable()
                ->get(function () {
                    $user = resolve(AssigneeFields::class)->enabled() ? resolve(AssistantBot::class)->get() : null;

                    return $user ? resolve(SystemUserPresenter::class)->present($user) : null;
                }),
        ]),

    (new Extend\Routes('api'))
        ->post('/canela/assign-assistant', 'canela.assign_assistant.create', CreateAssistantController::class),

    // Atribuído ao assistente: ele responde no tópico, pela fila.
    (new Extend\Event())
        ->listen(Assigned::class, function (Assigned $event): void {
            if ($event->assignee && resolve(AssistantBot::class)->is($event->assignee)) {
                /** @var Queue $queue */
                $queue = resolve(Queue::class);
                $queue->push(new AssistantReplyJob((int) $event->discussion->id, (int) $event->actor->id));
            }
        }),

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
