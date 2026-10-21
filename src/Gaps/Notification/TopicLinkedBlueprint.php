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

namespace Ramon\Canela\Gaps\Notification;

use Flarum\Database\AbstractModel;
use Flarum\Notification\AlertableInterface;
use Flarum\Notification\Blueprint\BlueprintInterface;
use Flarum\Post\Post;
use Flarum\User\User;

/**
 * "Fulano vinculou seu tópico": uma postagem de
 * outra pessoa traz um link para um tópico seu. O assunto é a postagem com o
 * link (é para lá que a notificação leva); o tópico vinculado vai nos dados.
 */
final class TopicLinkedBlueprint implements BlueprintInterface, AlertableInterface
{
    public function __construct(
        public readonly Post $post,
        public readonly User $linker,
        public readonly int $linkedDiscussionId,
    ) {
    }

    #[\Override]
    public function getSubject(): ?AbstractModel
    {
        return $this->post;
    }

    #[\Override]
    public function getFromUser(): ?User
    {
        return $this->linker;
    }

    #[\Override]
    public function getData(): mixed
    {
        return ['discussionId' => $this->linkedDiscussionId];
    }

    #[\Override]
    public static function getType(): string
    {
        return 'canelaTopicLinked';
    }

    #[\Override]
    public static function getSubjectModel(): string
    {
        return Post::class;
    }
}
