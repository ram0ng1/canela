<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Illuminate\Database\Schema\Builder;
use Ramon\Canela\Ai\Access\SeedAiPermissions;

/*
 * O acesso à IA vira permissão (Administração → Permissões): `canela.useAi`
 * e `canela.generateAiSummaries`, semeadas a partir das listas de grupos que
 * valiam até aqui, para ninguém ganhar nem perder acesso (SeedAiPermissions).
 *
 * As configurações antigas ficam no banco: só esta migração as lê, e um
 * `migrate:reset` seguido de `migrate` semeia de novo a partir delas.
 */
return [
    'up' => static function (Builder $schema): void {
        SeedAiPermissions::up($schema->getConnection());
    },

    'down' => static function (Builder $schema): void {
        SeedAiPermissions::down($schema->getConnection());
    },
];
