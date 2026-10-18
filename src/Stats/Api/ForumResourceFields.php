<?php

declare(strict_types=1);

namespace Ramon\Canela\Stats\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Ramon\Canela\Stats\StatsSettings;
use Ramon\Canela\Stats\TopicCounter;

/**
 * As contagens de "Novos" e "Não lidos" no fórum, para quem entrou.
 *
 * No ForumResource (e não no usuário) porque ele é serializado uma vez por
 * carga de página: o usuário atual aparece em qualquer listagem em que tenha
 * postado, e cada aparição refaria as duas contagens. Depois da carga, o
 * front-end atualiza os números por GET /api/canela-counts.
 */
final class ForumResourceFields
{
    public function __construct(
        private readonly StatsSettings $settings,
        private readonly TopicCounter $counter
    ) {
    }

    public function __invoke(): array
    {
        $visible = fn (object $model, Context $context): bool => $this->settings->countsEnabled() && ! $context->getActor()->isGuest();

        return [
            Schema\Integer::make('canelaNewCount')
                ->visible($visible)
                ->get(fn (object $model, Context $context) => $this->counter->newCount($context->getActor())),
            Schema\Integer::make('canelaUnreadCount')
                ->visible($visible)
                ->get(fn (object $model, Context $context) => $this->counter->unreadCount($context->getActor())),
        ];
    }
}
