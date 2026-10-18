<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Api;

use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Discussion\Discussion;
use Ramon\Canela\Stats\StatsSettings;

/**
 * `viewCount` no tópico — o nome que a lista do tema já procura e que as
 * extensões de visualização da comunidade também usam — e a ordenação por ele.
 */
final class DiscussionResourceFields
{
    public function __construct(
        private readonly StatsSettings $settings
    ) {
    }

    public function __invoke(): array
    {
        return [
            // Desligado, o atributo some da resposta: a coluna "Visualizações"
            // da lista se esconde sozinha quando nenhum tópico traz o número.
            Schema\Integer::make('viewCount')
                ->visible(fn () => $this->settings->viewsEnabled())
                ->get(fn (Discussion $discussion) => (int) ($discussion->getAttribute('canela_view_count') ?? 0)),
        ];
    }

    /**
     * `?sort=-viewCount`, ou o apelido `views` na URL do fórum (o pré-carregamento
     * da página inicial traduz o apelido pelo sortMap do recurso).
     */
    public static function sorts(): array
    {
        return [
            SortColumn::make('viewCount')
                ->column('discussions.canela_view_count')
                ->descendingAlias('views'),
        ];
    }
}
