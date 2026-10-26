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
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;

/**
 * Os números do mapa do tópico que o Flarum não guarda: quantas pessoas
 * postaram e quantas curtidas o tópico tem.
 *
 * Só na página do tópico (`showing`): na lista, seriam duas consultas por
 * linha, e a lista não mostra esses números. Os dois somam todas as
 * postagens do tópico, então ficam em cache: a chave muda quando chega
 * resposta, e as curtidas novas aparecem em até dois minutos.
 */
final class TopicMapFields
{
    private const CACHE_TTL = 120;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions,
        private readonly Cache $cache,
    ) {
    }

    private function cached(string $what, Discussion $discussion, callable $count): int
    {
        $key = sprintf('canela.topicmap.%s.%d.%d.%d', $what, $discussion->id, (int) $discussion->last_post_number, (int) $discussion->comment_count);

        return (int) $this->cache->remember($key, self::CACHE_TTL, $count);
    }

    public function __invoke(): array
    {
        $showing = static fn (Discussion $discussion, Context $context): bool => $context->showing(DiscussionResource::class);

        return [
            Schema\Integer::make('participantCount')
                ->visible($showing)
                ->get(fn (Discussion $discussion): int => $this->cached('participants', $discussion, fn (): int => (int) $this->visibleComments($discussion)
                    ->whereNotNull('user_id')
                    ->distinct()
                    ->count('user_id'))),

            Schema\Integer::make('canelaLikeCount')
                ->visible(fn (Discussion $discussion, Context $context): bool => $showing($discussion, $context) && $this->extensions->isEnabled('flarum-likes'))
                ->get(fn (Discussion $discussion): int => $this->cached('likes', $discussion, fn (): int => (int) $this->visibleComments($discussion)
                    ->join('post_likes', 'post_likes.post_id', '=', 'posts.id')
                    ->count())),
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
