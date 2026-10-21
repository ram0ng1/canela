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

use Flarum\Discussion\Discussion;
use Flarum\Http\UrlGenerator;
use Flarum\Notification\NotificationSyncer;
use Flarum\Post\CommentPost;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Flarum\Post\Post;
use Flarum\User\User;
use Ramon\Canela\Gaps\GapsSettings;
use Ramon\Canela\Gaps\Notification\TopicLinkedBlueprint;

/**
 * "Fulano vinculou seu tópico": uma postagem nova
 * (ou editada) com link para um tópico de outra pessoa avisa o autor dele.
 *
 * Os links são procurados no texto da postagem, apontando para este fórum
 * (/d/123 ou o endereço completo). No máximo alguns por postagem: uma lista
 * de links não pode virar uma enxurrada de notificações.
 */
final class NotifyTopicLinked
{
    private const MAX_LINKS = 5;

    public function __construct(
        private readonly NotificationSyncer $notifications,
        private readonly GapsSettings $gaps,
        private readonly UrlGenerator $url,
    ) {
    }

    public function handle(Posted|Revised $event): void
    {
        $post = $event->post;
        $actor = $event->actor ?? $post->user;

        if (! $this->gaps->on(GapsSettings::TOPIC_LINKED) || ! $post instanceof CommentPost || ! $actor) {
            return;
        }

        foreach ($this->linkedDiscussionIds($post) as $id) {
            $discussion = Discussion::query()->find($id);
            $author = $discussion?->user;

            if (! $author instanceof User || (int) $author->id === (int) $actor->id) {
                continue;
            }

            // O autor precisa poder ver a postagem que fez o link.
            if (! Post::query()->whereVisibleTo($author)->whereKey($post->id)->exists()) {
                continue;
            }

            $this->notifications->sync(new TopicLinkedBlueprint($post, $actor, (int) $id), [$author]);
        }
    }

    /** @return list<int> */
    private function linkedDiscussionIds(CommentPost $post): array
    {
        $text = (string) $post->content;
        $base = preg_quote(rtrim($this->url->to('forum')->base(), '/'), '#');
        $path = preg_quote((string) parse_url($this->url->to('forum')->base(), PHP_URL_PATH), '#');

        // O endereço completo do fórum ou o caminho dele, seguido de /d/{id}.
        preg_match_all('#(?:'.$base.'|(?<![\w/.])'.$path.')/d/(\d+)#i', $text, $matches);

        $ids = array_values(array_unique(array_map('intval', $matches[1] ?? [])));
        $ids = array_filter($ids, fn (int $id) => $id > 0 && $id !== (int) $post->discussion_id);

        return array_slice(array_values($ids), 0, self::MAX_LINKS);
    }
}
