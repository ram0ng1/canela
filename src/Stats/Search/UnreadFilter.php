<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Search;

use Flarum\Search\Database\DatabaseSearchState;
use Flarum\Search\Filter\FilterInterface;
use Flarum\Search\SearchState;
use Ramon\Canela\Stats\TopicCounter;

/**
 * `filter[canelaUnread]=1` — a aba "Não lidos": os tópicos já
 * abertos com respostas novas, pela mesma regra de "Não lidos (N)".
 *
 * @implements FilterInterface<DatabaseSearchState>
 */
final class UnreadFilter implements FilterInterface
{
    public function __construct(
        private readonly TopicCounter $counter
    ) {
    }

    #[\Override]
    public function getFilterKey(): string
    {
        return 'canelaUnread';
    }

    #[\Override]
    public function filter(SearchState $state, string|array $value, bool $negate): void
    {
        $actor = $state->getActor();

        // Para o visitante não há "não lido" pessoal: a lista fica como estava.
        if ($actor->isGuest() || $negate) {
            return;
        }

        $this->counter->constrainUnread($state->getQuery(), $actor);
    }
}
