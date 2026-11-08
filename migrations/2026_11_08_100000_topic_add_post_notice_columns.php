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

/*
 * Avisos de post (Ramon\Canela\Topic\PostNotice): o tipo ("first" ou
 * "returning") e a data da postagem anterior, gravados quando o post nasce.
 */
return Migration::addColumns('posts', [
    'canela_notice' => ['string', 'length' => 16, 'nullable' => true],
    'canela_notice_since' => ['dateTime', 'nullable' => true],
]);
