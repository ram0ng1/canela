<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Ramon\Canela\Stats\TopicCounter;

/**
 * `filter[canelaNew]=1` — a aba "Novos" do Discourse: só os tópicos que a
 * pessoa nunca abriu, pela mesma regra da contagem "Novos (N)".
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class NewFilter implements FilterInterface
{
    public function __construct(
        private readonly TopicCounter $counter
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return 'canelaNew';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();

        // Para o visitante não há "novo" pessoal: a lista fica como estava.
        if ($actor->isGuest() || $negate) {
            return;
        }

        $this->counter->constrainNew($state->getQuery(), $actor);
    }
}
