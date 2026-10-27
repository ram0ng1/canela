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

use Flarum\Extension\ExtensionManager;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Illuminate\Database\ConnectionInterface;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Activity\Search\ActivityUser;

/**
 * A subaba "Reações" do perfil: curtidas (flarum/likes) e reações
 * (fof/reactions) numa lista só, da mais nova para a mais antiga. No Canela
 * a curtida é a reação "coração", então as duas são uma coisa só para quem lê.
 *
 * Devolve só `{postId, reactionId, createdAt}` (`reactionId` nulo = curtida);
 * os posts vêm depois por `/api/posts?filter[id]=…`, com a visibilidade do
 * core. Aqui a visibilidade também vale: só posts que o visitante vê, e as
 * reações só com a permissão do fof de ver quem reagiu.
 */
final class ListReactionsController implements RequestHandlerInterface
{
    private const MAX_LIMIT = 50;

    public function __construct(
        private readonly ActivityUser $users,
        private readonly ConnectionInterface $db,
        private readonly ExtensionManager $extensions
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $params = $request->getQueryParams();
        $user = $this->users->resolve((string) Arr::get($params, 'username', ''), $actor);
        $offset = max(0, (int) Arr::get($params, 'offset', 0));
        $limit = min(self::MAX_LIMIT, max(1, (int) Arr::get($params, 'limit', 20)));

        $parts = [];
        $visible = static fn () => Post::whereVisibleTo($actor)->select('posts.id');

        if ($user && $this->extensions->isEnabled('flarum-likes')) {
            $parts[] = $this->db->table('post_likes')
                ->select('post_id', $this->db->raw('NULL as reaction_id'), 'created_at')
                ->where('user_id', (int) $user->id)
                ->whereIn('post_id', $visible());
        }

        if ($user && $this->extensions->isEnabled('fof-reactions') && $actor->hasPermission('discussion.canSeeReactions')) {
            $parts[] = $this->db->table('post_reactions')
                ->select('post_id', 'reaction_id', 'created_at')
                ->where('user_id', (int) $user->id)
                ->whereNotNull('reaction_id')
                ->whereIn('post_id', $visible());
        }

        if (! $parts) {
            return new JsonResponse(['data' => [], 'hasMore' => false]);
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

        return new JsonResponse(['data' => $data, 'hasMore' => $rows->count() > $limit]);
    }
}
