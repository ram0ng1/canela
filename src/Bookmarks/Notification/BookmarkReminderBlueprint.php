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

namespace Ramon\Canela\Bookmarks\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Post\Post;
use Flarum\User\User;
use Ramon\Canela\Bookmarks\Bookmark;
use Ramon\Canela\System\SystemUser;

/**
 * "Lembrete do marcador": o alerta que o comando agendado manda quando o
 * horário escolhido chega.
 *
 * O assunto é o post, e não o marcador: a notificação leva até ele, e o
 * NotificationResource do core já sabe serializar posts (com o tópico). O
 * nome do marcador vai nos dados, para o alerta mostrá-lo.
 *
 * O horário do lembrete também entra nos dados de propósito: o core reconhece
 * uma notificação "igual" pelos dados, e sem ele um segundo lembrete no mesmo
 * post só reativaria o primeiro, sem alertar de novo.
 */
final class BookmarkReminderBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly Bookmark $bookmark,
        public readonly Post $post,
    ) {
    }

    #[\Override]
    public function getSubject(): ?AbstractModel
    {
        return $this->post;
    }

    /**
     * O lembrete é do sistema: com o usuário do sistema criado, sai em nome
     * dele; sem ele, sem remetente.
     */
    #[\Override]
    public function getFromUser(): ?User
    {
        return SystemUser::current();
    }

    #[\Override]
    public function getData(): mixed
    {
        return [
            'bookmarkId' => $this->bookmark->id,
            'name' => $this->bookmark->name,
            'reminderAt' => $this->bookmark->reminder_at?->toIso8601String(),
        ];
    }

    #[\Override]
    public static function getType(): string
    {
        return 'canelaBookmarkReminder';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return Post::class;
    }
}
