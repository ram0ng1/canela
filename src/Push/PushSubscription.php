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

namespace Ramon\Canela\Push;

use Flarum\Database\AbstractModel;

/**
 * Um aparelho com o push ligado.
 *
 * @property int $id
 * @property int $user_id
 * @property string $endpoint_hash
 * @property string $endpoint
 * @property string $public_key
 * @property string $auth_token
 */
class PushSubscription extends AbstractModel
{
    protected $table = 'canela_push_subscriptions';

    public $timestamps = true;

    protected $fillable = ['user_id', 'endpoint_hash', 'endpoint', 'public_key', 'auth_token'];
}
