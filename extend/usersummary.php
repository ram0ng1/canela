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
 * As seções do Resumo do perfil do Discourse que dependem de contas no banco:
 * "Mais respondidos(as)", "Mais curtido por", "Com mais curtidas" e "Melhores
 * categorias". Só leitura: nenhuma tabela nova, nenhuma migration.
 */

use Flarum\Extend;
use Ramon\Canela\UserSummary\ShowUserSummaryController;

return [
    (new Extend\Routes('api'))
        ->get('/canela-user-summary/{id:\d+}', 'canela.user_summary', ShowUserSummaryController::class),
];
