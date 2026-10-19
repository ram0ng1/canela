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

use Flarum\Api\Context;
use Flarum\Api\Resource\ForumResource;
use Flarum\Api\Resource\GroupResource;
use Flarum\Api\Schema;
use Flarum\Group\Group;
use Illuminate\Contracts\Cache\Repository as Cache;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Community\Community;

/**
 * `canelaMemberCount` nos grupos, para os cartões da página /g.
 *
 * Só no payload do fórum (de onde a página /g lê os grupos) e nos endpoints
 * de grupos: os grupos também vão junto de cada usuário nas listas, e ali a
 * contagem não serve para nada (o fórum guarda o valor que já tinha).
 *
 * A contagem de todos os grupos sai numa consulta só, agrupada, e fica no
 * cache por alguns minutos (ela varre `group_user` inteira). Entrar ou sair de
 * um grupo e apagar uma conta a apagam (extend/community.php).
 */
final class GroupFields
{
    public const CACHE_KEY = 'ramon-canela.group-member-counts';

    private const TTL = 300;

    /** @var array<int, int>|null */
    private ?array $counts = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Community $community,
        private readonly Cache $cache,
    ) {
    }

    /** @return list<Schema\Integer> */
    public function __invoke(): array
    {
        return [
            Schema\Integer::make('canelaMemberCount')
                ->visible(fn (Group $group, Context $context) => $this->community->enabled(Community::GROUPS_ENABLED)
                    && ($context->showing(ForumResource::class) || $context->showing(GroupResource::class) || $context->listing(GroupResource::class)))
                ->get(fn (Group $group) => $this->count($group)),
        ];
    }

    private function count(Group $group): int
    {
        $this->counts ??= $this->cache->remember(self::CACHE_KEY, self::TTL, fn (): array => $this->db->table('group_user')
            ->select('group_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy('group_id')
            ->pluck('aggregate', 'group_id')
            ->map(fn ($count) => (int) $count)
            ->all());

        return $this->counts[$group->id] ?? 0;
    }
}
