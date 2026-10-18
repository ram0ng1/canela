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
use Flarum\User\User;
use Illuminate\Support\Arr;
use Laminas\Diactoros\Response\JsonResponse;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Ramon\Canela\Community\Community;
use Ramon\Canela\Community\Directory;
use Ramon\Canela\Community\UserPresenter;

/**
 * GET /api/canela-directory?period=&order=&dir=&q=&page=&group=
 *
 * Sem `group`, é o diretório de usuários (/u). Com `group`, a lista de
 * membros da página do grupo (/g/:nome) — a mesma tabela, filtrada, e por
 * isso o mesmo endpoint. Nos dois casos vale a permissão do core de listar
 * usuários: os membros de um grupo são uma lista de usuários como outra.
 *
 * Valores fora do esperado (período, coluna, página) caem no padrão em vez de
 * dar erro: a URL do fórum é editável, e um parâmetro velho num link salvo não
 * deveria quebrar a página.
 */
final class ListDirectoryController implements RequestHandlerInterface
{
    /** Mais do que isso é raspagem, não navegação. */
    private const MAX_PAGE = 200;

    public function __construct(
        private readonly Community $community,
        private readonly Directory $directory,
        private readonly UserPresenter $presenter,
    ) {
    }

    #[\Override]
    public function handle(ServerRequestInterface $request): ResponseInterface
    {
        $actor = RequestUtil::getActor($request);
        $params = $request->getQueryParams();

        $groupId = $this->groupId($actor, Arr::get($params, 'group'));

        $this->community->assertEnabled($groupId === null ? Community::DIRECTORY_ENABLED : Community::GROUPS_ENABLED);
        $this->community->assertCanListUsers($actor);

        $columns = $this->directory->columns($actor);
        $sortable = [...$columns, 'username', 'joinedAt'];

        $period = (string) Arr::get($params, 'period', 'all');
        $period = array_key_exists($period, Directory::PERIODS) ? $period : 'all';

        $order = (string) Arr::get($params, 'order', '');
        $order = in_array($order, $sortable, true) ? $order : ($groupId === null ? $this->directory->defaultOrder() : 'username');

        // Sem sentido pedido, nomes vão de A a Z e números do maior ao menor.
        $dir = Arr::get($params, 'dir');
        $ascending = $dir === null || $dir === '' ? $order === 'username' : $dir === 'asc';
        $search = mb_substr(trim((string) Arr::get($params, 'q', '')), 0, 100);
        $page = min(self::MAX_PAGE, max(1, (int) Arr::get($params, 'page', 1)));

        $result = $this->directory->query($actor, $period, $order, $ascending, $search, $page, $groupId);

        return new JsonResponse([
            'data' => array_map(fn (User $user) => [
                'user' => (string) $user->id,
                ...$this->directory->stats($user),
            ], $result['users']),
            'included' => $this->presenter->many($result['users'], $actor),
            'meta' => [
                'columns' => $columns,
                'period' => $period,
                'order' => $order,
                'dir' => $ascending ? 'asc' : 'desc',
                'page' => $page,
                'perPage' => Directory::PAGE_SIZE,
                'total' => $result['total'],
                'hasMore' => $result['hasMore'],
            ],
        ]);
    }

    /**
     * O grupo pedido, se o ator pode vê-lo. Visitantes e Membros não são
     * grupos de verdade (ninguém é "adicionado" a eles) e não têm página.
     */
    private function groupId(User $actor, mixed $value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $id = (int) $value;

        if (in_array($id, [Group::GUEST_ID, Group::MEMBER_ID], true) || ! Group::query()->whereVisibleTo($actor)->whereKey($id)->exists()) {
            throw new RouteNotFoundException();
        }

        return $id;
    }
}
