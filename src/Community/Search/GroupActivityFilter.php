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

namespace Ramon\Canela\Community\Search;

use Flarum\Group\Group;
use Flarum\Http\Exception\RouteNotFoundException;
use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\Search\ValidateFilterTrait;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Ramon\Canela\Community\Community;

/**
 * `filter[canelaGroup]=<id>` na busca de postagens: as respostas e primeiras
 * postagens dos membros de um grupo — a aba "Atividade" da página do grupo
 * (`/api/posts?filter[canelaGroup]=6&sort=-createdAt`).
 *
 * É o /api/posts do core: cada postagem sai com o que as extensões
 * acrescentam (curtidas, menções) e com a visibilidade do ator. O filtro só
 * acrescenta o grupo e as regras da aba:
 *
 * - grupos ou a aba desligados no admin: 404;
 * - a aba diz quem está no grupo (os autores), então pede a mesma permissão
 *   da lista de membros (Community::assertCanListUsers), e não só a de ver o
 *   fórum: 403;
 * - Visitantes e Membros não são grupos de verdade, e um grupo oculto para o
 *   ator é como se não existisse: 404.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class GroupActivityFilter implements FilterInterface
{
    use ValidateFilterTrait;

    public const KEY = 'canelaGroup';

    public function __construct(
        private readonly Community $community,
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return self::KEY;
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $this->community->assertEnabled(Community::GROUPS_ENABLED);
        $this->community->assertEnabled(Community::GROUPS_ACTIVITY);

        $actor = $state->getActor();
        $this->community->assertCanListUsers($actor);

        $groupId = $this->asInt($value);

        if (in_array($groupId, [Group::GUEST_ID, Group::MEMBER_ID], true) || ! Group::query()->whereVisibleTo($actor)->whereKey($groupId)->exists()) {
            throw new RouteNotFoundException();
        }

        $state->getQuery()
            ->where('posts.type', 'comment')
            ->whereIn(
                'posts.user_id',
                static fn (QueryBuilder $members) => $members->select('user_id')->from('group_user')->where('group_id', $groupId),
                'and',
                $negate
            );
    }
}
