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

namespace Ramon\Canela\Activity\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Flarum\User\User;
use FoF\Polls\Poll;
use Illuminate\Database\ConnectionInterface;

/**
 * A aba "Votos" do perfil: as postagens com enquetes do fof/polls em que a
 * pessoa votou, em `/api/posts?filter[canelaVoter]=slug`.
 *
 * Em quem alguém votou só é público quando a enquete mostra os votantes: a
 * regra é a do próprio fof (`seeVoters`), enquete por enquete. A própria
 * pessoa vê todas as suas. A visibilidade das postagens continua a do core.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class VotedByFilter implements FilterInterface
{
    /** Teto de enquetes avaliadas por pedido: folgado para um perfil. */
    private const MAX_POLLS = 500;

    public function __construct(
        private readonly ActivityUser $users,
        private readonly ConnectionInterface $db
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return 'canelaVoter';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();
        $user = $this->users->resolve($value, $actor);
        $postIds = $user && ! $negate ? $this->visiblePostIds($actor, $user) : [];

        $state->getQuery()->whereIn('posts.id', $postIds);
    }

    /** @return list<int> */
    private function visiblePostIds(User $actor, User $user): array
    {
        $pollIds = $this->db->table('poll_votes')
            ->where('user_id', (int) $user->id)
            ->orderByDesc('id')
            ->limit(self::MAX_POLLS)
            ->pluck('poll_id')
            ->unique()
            ->all();

        if (! $pollIds) {
            return [];
        }

        $self = $actor->id === $user->id;
        $ids = [];

        foreach (Poll::query()->whereIn('id', $pollIds)->whereNotNull('post_id')->get() as $poll) {
            if ($self || $actor->can('seeVoters', $poll)) {
                $ids[] = (int) $poll->post_id;
            }
        }

        return array_values(array_unique($ids));
    }
}
