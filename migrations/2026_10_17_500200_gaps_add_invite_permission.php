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
 * Permissões). O Discourse libera a partir do nível de confiança 2; aqui a
 * permissão por grupo é o equivalente que o Flarum tem.
 */
return Migration::addPermissions([
    'canela.createInvite' => Group::MEMBER_ID,
]);
