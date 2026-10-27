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

namespace Ramon\Canela\Activity\Api;

use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Extension\ExtensionManager;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\ConnectionInterface;
use Laminas\Diactoros\Response\JsonResponse;

/**
 * `GET /api/users/{id}/canela-reactions?page[offset]=0&page[limit]=20`: a
 * subaba "Reações" do perfil, num endpoint de ação do recurso de usuários (a
 * pessoa passa pela visibilidade do recurso: quem não se vê, 404).
 *
 * A subaba: curtidas (flarum/likes) e reações
 * (fof/reactions) numa lista só, da mais nova para a mais antiga. No Canela
 * a curtida é a reação "coração", então as duas são uma coisa só para quem lê.
 *
 * Devolve só `{postId, reactionId, createdAt}` (`reactionId` nulo = curtida);
 * os posts vêm depois por `/api/posts?filter[id]=…`, com a visibilidade do
 * core. Aqui a visibilidade também vale: só posts que o visitante vê, e as
 * reações só com a permissão do fof de ver quem reagiu.
 */
final class ListReactions
{
    private const MAX_LIMIT = 50;

    private const DEFAULT_LIMIT = 20;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions
    ) {
    }

    public static function endpoint(): Endpoint\Endpoint
    {
        return Endpoint\Endpoint::make('canela.reactions')
            ->route('GET', '/{id}/canela-reactions')
            ->action(static fn (Context $context): array => resolve(self::class)->list($context))
            ->response(static fn (Context $context, array $page): JsonResponse => new JsonResponse($page));
    }

    /** @return array{data: list<array{postId: int, reactionId: int|null, createdAt: mixed}>, hasMore: bool} */
    public function list(Context $context): array
    {
        $actor = $context->getActor();
        /** @var User $user */
        $user = $context->model;
        $page = $context->request->getQueryParams()['page'] ?? [];
        $page = is_array($page) ? $page : [];
        $offset = max(0, (int) ($page['offset'] ?? 0));
        $limit = min(self::MAX_LIMIT, max(1, (int) ($page['limit'] ?? self::DEFAULT_LIMIT)));

        $parts = [];
        $visible = static fn () => Post::whereVisibleTo($actor)->select('posts.id');

        if ($this->extensions->isEnabled('flarum-likes')) {
            $parts[] = $this->db->table('post_likes')
                ->select('post_id', $this->db->raw('NULL as reaction_id'), 'created_at')
                ->where('user_id', (int) $user->id)
                ->whereIn('post_id', $visible());
        }

        if ($this->extensions->isEnabled('fof-reactions') && $actor->hasPermission('discussion.canSeeReactions')) {
            $parts[] = $this->db->table('post_reactions')
                ->select('post_id', 'reaction_id', 'created_at')
                ->where('user_id', (int) $user->id)
                ->whereNotNull('reaction_id')
                ->whereIn('post_id', $visible());
        }

        if (! $parts) {
            return ['data' => [], 'hasMore' => false];
        }

        $query = array_shift($parts);

        foreach ($parts as $part) {
            $query->unionAll($part);
        }

        // Uma linha a mais só para saber se há próxima página.
        $rows = $query->newQuery()->fromSub($query, 'canela_reactions')
            ->orderByDesc('created_at')
            ->offset($offset)
            ->limit($limit + 1)
            ->get();

        $data = $rows->take($limit)->map(static fn (object $row): array => [
            'postId' => (int) $row->post_id,
            'reactionId' => $row->reaction_id === null ? null : (int) $row->reaction_id,
            'createdAt' => $row->created_at,
        ])->values()->all();

        return ['data' => $data, 'hasMore' => $rows->count() > $limit];
    }
}
