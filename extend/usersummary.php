<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

/*
 * As seções do Resumo do perfil que dependem de contas no banco:
 * "Mais respondidos(as)", "Mais curtido por", "Com mais curtidas" e "Melhores
 * categorias". Só leitura: nenhuma tabela nova, nenhuma migration.
 */

use Flarum\Api\Resource\UserResource;
use Flarum\Extend;
use Ramon\Canela\UserSummary\ShowUserSummary;

return [
    // `GET /api/users/{id}/canela-summary`.
    (new Extend\ApiResource(UserResource::class))
        ->endpoints(static fn (): array => [ShowUserSummary::endpoint()]),
];
