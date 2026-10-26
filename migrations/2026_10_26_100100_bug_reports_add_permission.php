<?php

/*
 * This file is part of ramon/canela.
 *
 * Copyright (c) 2026 Ramon Guilherme.
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

use Flarum\Database\Migration;
use Flarum\Group\Group;

/*
 * Quem pode relatar problemas: os membros, por padrão (o admin muda em
 * Permissões). O recurso em si vem desligado.
 */
return Migration::addPermissions([
    'canela.reportBugs' => Group::MEMBER_ID,
]);
