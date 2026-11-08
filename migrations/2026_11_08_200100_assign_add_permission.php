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
 * Quem pode atribuir tópicos: os moderadores, por padrão (o admin muda em
 * Permissões).
 */
return Migration::addPermissions([
    'discussion.canelaAssign' => Group::MODERATOR_ID,
]);
