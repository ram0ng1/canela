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

namespace Ramon\Canela\Activity\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;

/**
 * O que o perfil precisa saber para mostrar as subabas de "Atividade":
 * - `canelaActivityFilters`: os filtros deste recurso existem (Lidos e
 *   Votos dependem deles; com o recurso desligado as abas somem);
 * - `canelaCanSeeReactions`: o visitante pode ver quem reagiu (a permissão
 *   do fof/reactions). Sem ela a aba "Reações" viria sempre vazia.
 */
final class ForumActivityFields
{
    /** @return list<Schema\Boolean> */
    public function __invoke(): array
    {
        return [
            Schema\Boolean::make('canelaActivityFilters')
                ->get(static fn (): bool => true),
            Schema\Boolean::make('canelaCanSeeReactions')
                ->get(static fn (mixed $forum, Context $context): bool => $context->getActor()->hasPermission('discussion.canSeeReactions')),
        ];
    }
}
