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
 * Quem pode gerar links de convite: os membros, por padrão (o admin muda em
 * Permissões): a permissão por grupo, em vez de um nível de confiança mínimo.
 */
return Migration::addPermissions([
    'canela.createInvite' => Group::MEMBER_ID,
]);
