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

use Flarum\Api\Schema;
use Flarum\Group\Group;
use Illuminate\Database\ConnectionInterface;
use Ramon\Canela\Community\Community;

/**
 * `canelaMemberCount` nos grupos, para os cartões da página /g.
 *
 * Os grupos vão em todo carregamento do fórum (o ForumResource os inclui), e
 * contar os membros de um por um seria uma consulta por grupo em toda página.
 * A contagem sai numa consulta só, agrupada, guardada nesta instância — o
 * extender cria uma por requisição.
 */
final class GroupFields
{
    /** @var array<int, int>|null */
    private ?array $counts = null;

    public function __construct(
        private readonly ConnectionInterface $db,
        private readonly Community $community,
    ) {
    }

    /** @return list<Schema\Integer> */
    public function __invoke(): array
    {
        return [
            Schema\Integer::make('canelaMemberCount')
                ->visible(fn () => $this->community->enabled(Community::GROUPS_ENABLED))
                ->get(fn (Group $group) => $this->count($group)),
        ];
    }

    private function count(Group $group): int
    {
        $this->counts ??= $this->db->table('group_user')
            ->select('group_id')
            ->selectRaw('COUNT(*) as aggregate')
            ->groupBy('group_id')
            ->pluck('aggregate', 'group_id')
            ->map(fn ($count) => (int) $count)
            ->all();

        return $this->counts[$group->id] ?? 0;
    }
}
