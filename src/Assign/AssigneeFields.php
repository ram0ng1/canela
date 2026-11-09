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
use Flarum\Settings\SettingsRepositoryInterface;
use Flarum\User\Exception\PermissionDeniedException;
use Flarum\User\User;

/**
 * `canelaAssignee`: quem cuida do tópico (como o assign do Discourse).
 * Desligado por padrão (`canela.assign_enabled`). Quem tem a permissão
 * `discussion.canelaAssign` (por padrão, moderadores; respeita as permissões
 * por tag) troca ou remove pelo PATCH do tópico, e o próprio responsável
 * sempre pode se remover. O novo responsável recebe a notificação; atribuir
 * a si mesmo não notifica.
 */
final class AssigneeFields
{
    public const ENABLED = 'canela.assign_enabled';

    public function __construct(
        private readonly NotificationSyncer $notifications,
        private readonly SettingsRepositoryInterface $settings,
    ) {
    }

    public function enabled(): bool
    {
        return (bool) $this->settings->get(self::ENABLED);
    }

    private function canAssign(Discussion $discussion, User $actor): bool
    {
        return $this->enabled() && $actor->can('canelaAssign', $discussion);
    }

    private function isAssignee(Discussion $discussion, User $actor): bool
    {
        return $this->enabled() && ! $actor->isGuest() && (int) $discussion->getAttribute('canela_assignee_id') === (int) $actor->id;
    }

    public function __invoke(): array
    {
        return [
            Schema\Relationship\ToOne::make('canelaAssignee')
                ->type('users')
                ->includable()
                ->nullable()
                ->writable(fn (Discussion $discussion, Context $context) => $context->updating() && ($this->canAssign($discussion, $context->getActor()) || $this->isAssignee($discussion, $context->getActor())))
                ->set(function (Discussion $discussion, ?User $assignee, Context $context): void {
                    $actor = $context->getActor();

                    // Sem a permissão, só dá para tirar a si mesmo.
                    if (! $this->canAssign($discussion, $actor) && $assignee !== null) {
                        throw new PermissionDeniedException();
                    }

                    if ((int) $discussion->getAttribute('canela_assignee_id') === (int) $assignee?->id) {
                        return;
                    }

                    $discussion->setAttribute('canela_assignee_id', $assignee?->id);
                    $discussion->raise(new Assigned($discussion, $actor, $assignee));

                    if ($assignee && $assignee->id !== $actor->id) {
                        $discussion->afterSave(fn () => $this->notifications->sync(new AssignedBlueprint($discussion, $actor), [$assignee]));
                    }
                }),

            Schema\Boolean::make('canCanelaAssign')
                ->get(fn (Discussion $discussion, Context $context) => $this->canAssign($discussion, $context->getActor())),
        ];
    }
}
