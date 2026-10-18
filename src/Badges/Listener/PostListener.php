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

namespace Ramon\Canela\Badges\Listener;

use Flarum\Post\CommentPost;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Flarum\Post\Post;
use Ramon\Canela\Badges\BadgeQueries;
use Ramon\Canela\Badges\Scope;

/**
 * Postagem nova ou editada: Editor(a), Primeira citação, Primeiro link,
 * Primeira menção, Primeiro emoji (o `Trigger::PostRevision` do Discourse) e
 * a revisão de nível do autor — responder conta para o nível 2.
 */
final class PostListener
{
    public function __construct(
        private readonly BadgeEvents $events,
    ) {
    }

    public function posted(Posted $event): void
    {
        $this->handle($event->post);
    }

    public function revised(Revised $event): void
    {
        $this->handle($event->post);
    }

    /** Postagem aprovada (flarum/approval): só agora ela é pública e conta. */
    public function approved(object $event): void
    {
        if (isset($event->post) && $event->post instanceof Post) {
            $this->handle($event->post);
        }
    }

    private function handle(Post $post): void
    {
        if (! $post instanceof CommentPost || ! $post->user_id) {
            return;
        }

        $this->events->grant(BadgeQueries::TRIGGER_POST, Scope::posts([$post->id]));
        $this->events->review([$post->user]);
    }
}
