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

namespace Ramon\Canela\Stats\Api;

use Flarum\Api\Context;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Illuminate\Database\ConnectionInterface;

/**
 * Os números do mapa do tópico que o Flarum não guarda: quantas pessoas
 * postaram e quantas curtidas o tópico tem.
 *
 * Só na página do tópico (`showing`): na lista, seriam duas consultas por
 * linha, e a lista não mostra esses números.
 */
final class TopicMapFields
{
    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions
    ) {
    }

    public function __invoke(): array
    {
        $showing = static fn (Discussion $discussion, Context $context): bool => $context->showing(DiscussionResource::class);

        return [
            Schema\Integer::make('participantCount')
                ->visible($showing)
                ->get(fn (Discussion $discussion): int => (int) $this->visibleComments($discussion)
                    ->whereNotNull('user_id')
                    ->distinct()
                    ->count('user_id')),

            Schema\Integer::make('canelaLikeCount')
                ->visible(fn (Discussion $discussion, Context $context): bool => $showing($discussion, $context) && $this->extensions->isEnabled('flarum-likes'))
                ->get(fn (Discussion $discussion): int => (int) $this->visibleComments($discussion)
                    ->join('post_likes', 'post_likes.post_id', '=', 'posts.id')
                    ->count()),
        ];
    }

    /** Os comentários que qualquer leitor do tópico vê: o mapa é igual para todos. */
    private function visibleComments(Discussion $discussion)
    {
        return $this->db->table('posts')
            ->where('posts.discussion_id', $discussion->id)
            ->where('posts.type', 'comment')
            ->whereNull('posts.hidden_at')
            ->where('posts.is_private', false);
    }
}
