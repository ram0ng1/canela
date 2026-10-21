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

namespace Ramon\Canela\Gaps\Listener;

use Flarum\Notification\NotificationSyncer;
use Flarum\Post\Event\Revised;
use Flarum\Post\Post;
use Ramon\Canela\Gaps\GapsSettings;
use Ramon\Canela\Gaps\Notification\PostEditedBlueprint;

/**
 * Avisa o autor quando outra pessoa edita a postagem dele. A própria edição
 * não avisa ninguém.
 */
final class NotifyPostEdited
{
    public function __construct(
        private readonly NotificationSyncer $notifications,
        private readonly GapsSettings $gaps,
    ) {
    }

    public function handle(Revised $event): void
    {
        $post = $event->post;
        $author = $post->user;

        if (! $this->gaps->on(GapsSettings::POST_EDITED) || ! $author || (int) $author->id === (int) $event->actor->id) {
            return;
        }

        // Quem não vê mais a postagem (tópico movido para uma categoria
        // restrita, por exemplo) não tem o que abrir.
        if (! Post::query()->whereVisibleTo($author)->whereKey($post->id)->exists()) {
            return;
        }

        $this->notifications->sync(new PostEditedBlueprint($post, $event->actor), [$author]);
    }
}
