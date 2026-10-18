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
use Ramon\Canela\Badges\BadgeSettings;
use Ramon\Canela\Badges\SystemBadges;

/*
 * Os emblemas do sistema. A lista mora em SystemBadges (e não aqui) porque as
 * regras que os concedem são procuradas pelo mesmo slug: uma lista só evita
 * um emblema semeado sem regra, ou uma regra sem emblema.
 *
 * Também marca o esquema como instalado (`canela.badges_schema`): o tipo de
 * notificação só é registrado depois disso, porque o core consulta a tabela
 * do assunto de cada tipo ao contar as notificações de quem está logado — sem
 * a tabela, toda página daria erro.
 *
 * As concessões não acontecem aqui: o primeiro `canela:badges` (o agendado ou
 * o rodado à mão) faz a carga inicial, sem notificar ninguém.
 */
return [
    'up' => static function (Builder $schema): void {
        $connection = $schema->getConnection();

        SystemBadges::seed($connection, BadgeSettings::removedSystemSlugs($connection));

        $connection->table('settings')->updateOrInsert(['key' => BadgeSettings::SCHEMA_INSTALLED], ['value' => '1']);
    },

    'down' => static function (Builder $schema): void {
        $connection = $schema->getConnection();

        $connection->table('settings')->whereIn('key', [BadgeSettings::SCHEMA_INSTALLED, BadgeSettings::BACKFILLED_AT])->delete();
        $connection->table('canela_badges')->where('system', true)->delete();
    },
];
