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

namespace Ramon\Canela\Assign;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Notification\NotificationSyncer;
use Flarum\User\User;

/**
 * `canelaAssignee`: quem cuida do tópico (como o assign do Discourse).
 * Quem tem a permissão `discussion.canelaAssign` (por padrão, moderadores;
 * respeita as permissões por tag) troca ou remove pelo PATCH do tópico. O
 * novo responsável recebe a notificação; atribuir a si mesmo não notifica.
 */
final class AssigneeFields
{
    public function __construct(
        private readonly NotificationSyncer $notifications,
    ) {
    }

    public function __invoke(): array
    {
        return [
            Schema\Relationship\ToOne::make('canelaAssignee')
                ->type('users')
                ->includable()
                ->nullable()
                ->writable(fn (Discussion $discussion, Context $context) => $context->updating() && $context->getActor()->can('canelaAssign', $discussion))
                ->set(function (Discussion $discussion, ?User $assignee, Context $context): void {
                    if ($discussion->canela_assignee_id === $assignee?->id) {
                        return;
                    }

                    $actor = $context->getActor();
                    $discussion->canela_assignee_id = $assignee?->id;
                    $discussion->raise(new Assigned($discussion, $actor, $assignee));

                    if ($assignee && $assignee->id !== $actor->id) {
                        $discussion->afterSave(fn () => $this->notifications->sync(new AssignedBlueprint($discussion, $actor), [$assignee]));
                    }
                }),

            Schema\Boolean::make('canCanelaAssign')
                ->get(fn (Discussion $discussion, Context $context) => $context->getActor()->can('canelaAssign', $discussion)),
        ];
    }
}
