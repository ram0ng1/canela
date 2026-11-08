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
use Ramon\Canela\Assign\Assigned;
use Ramon\Canela\Assign\AssignedBlueprint;
use Ramon\Canela\Assign\AssignedFilter;
use Ramon\Canela\Assign\AssigneeFields;

return [
    (new Extend\Model(Discussion::class))
        ->belongsTo('canelaAssignee', User::class, 'canela_assignee_id'),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(AssigneeFields::class)
        ->endpoint([Endpoint\Index::class, Endpoint\Show::class, Endpoint\Update::class], fn ($endpoint) => $endpoint->addDefaultInclude(['canelaAssignee'])),

    // "Atribuídos a mim" na barra lateral só para quem atribui (a equipe).
    (new Extend\ApiResource(ForumResource::class))
        ->fields(fn () => [
            Schema\Boolean::make('canelaCanAssign')
                ->get(fn ($forum, Context $context) => $context->getActor()->hasPermission('discussion.canelaAssign')),
        ]),

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
