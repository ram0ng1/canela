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

namespace Ramon\Canela\Community\Api;

use Flarum\Group\Group;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Http\RequestUtil;
use Flarum\Post\Post;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Community\Community;

/**
 * GET /api/canela-groups/{id}/activity?page= — as postagens recentes dos
 * membros de um grupo (a aba "Atividade" do Discourse).
 *
 * Devolve só os ids, já filtrados pela visibilidade do ator: o fórum busca as
 * postagens em /api/posts?filter[id]=…, que serializa cada uma com tudo o que
 * as extensões acrescentam (curtidas, menções) e checa a visibilidade de novo.
 * Filtrar por autor direto no /api/posts exigiria pôr na URL o nome de cada
 * membro do grupo.
 */
final class ListGroupActivityController implements RequestHandlerInterface
{
    public const PAGE_SIZE = 20;

    private const MAX_PAGE = 50;

    public function __construct(
        private readonly Community $community,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $this->community->assertEnabled(Community::GROUPS_ENABLED);
        $this->community->assertEnabled(Community::GROUPS_ACTIVITY);

        $actor = RequestUtil::getActor($request);
        $actor->assertCan('viewForum');

        $params = $request->getQueryParams();
        $groupId = (int) Arr::get($params, 'id');

        if (in_array($groupId, [Group::GUEST_ID, Group::MEMBER_ID], true) || ! Group::query()->whereVisibleTo($actor)->whereKey($groupId)->exists()) {
            throw new RouteNotFoundException();
        }

        $page = min(self::MAX_PAGE, max(1, (int) Arr::get($params, 'page', 1)));

        $ids = Post::query()
            ->whereVisibleTo($actor)
            ->where('posts.type', 'comment')
            ->whereIn('posts.user_id', fn (QueryBuilder $members) => $members->select('user_id')->from('group_user')->where('group_id', $groupId))
            ->orderByDesc('posts.created_at')
            ->offset(($page - 1) * self::PAGE_SIZE)
            ->limit(self::PAGE_SIZE + 1)
            ->pluck('posts.id')
            ->map(fn ($id) => (string) $id)
            ->all();

        return new JsonResponse([
            'data' => array_slice($ids, 0, self::PAGE_SIZE),
            'meta' => [
                'page' => $page,
                'hasMore' => count($ids) > self::PAGE_SIZE,
            ],
        ]);
    }
}
