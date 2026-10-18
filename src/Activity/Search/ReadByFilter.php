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
use Illuminate\Database\Query\Builder;

/**
 * A aba "Lidos" do perfil: os tópicos que a pessoa leu, do mais recente para
 * o mais antigo (`discussion_user.last_read_at`).
 *
 * O que alguém leu é pessoal: para quem não é a própria pessoa nem
 * administrador, a lista sai vazia. A ordem vem de uma subconsulta, e não de
 * um JOIN, para as colunas de `discussion_user` (como `user_id`) não
 * sobrescreverem as do tópico. Os filtros rodam antes da ordenação do core,
 * então esta fica como a principal.
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class ReadByFilter implements FilterInterface
{
    public function __construct(
        private readonly ActivityUser $users
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return 'canelaReadBy';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();
        $user = $this->users->resolve($value, $actor);
        $query = $state->getQuery();

        if ($negate || ! $user || ! ActivityUser::canSeePrivate($actor, $user)) {
            $query->whereRaw('1 = 0');

            return;
        }

        $userId = (int) $user->id;
        $read = static fn (Builder $sub): Builder => $sub
            ->from('discussion_user')
            ->whereColumn('discussion_user.discussion_id', 'discussions.id')
            ->where('discussion_user.user_id', $userId)
            ->whereNotNull('discussion_user.last_read_at');

        $query->whereExists(static fn (Builder $sub): Builder => $read($sub)->selectRaw('1'));
        $query->orderByDesc(static fn (Builder $sub): Builder => $read($sub)->select('discussion_user.last_read_at')->limit(1));
    }
}
