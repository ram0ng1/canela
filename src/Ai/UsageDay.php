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

namespace Ramon\Canela\Ai;

use Flarum\Database\AbstractModel;

/**
 * O uso de IA de uma pessoa num dia (pedidos e tokens).
 *
 * @property int $user_id
 * @property string $day
 * @property int $requests
 * @property int $input_tokens
 * @property int $output_tokens
 */
final class UsageDay extends AbstractModel
{
    protected $table = 'canela_ai_usage';

    public $incrementing = false;

    public $timestamps = false;

    protected $casts = [
        'user_id' => 'integer',
        'requests' => 'integer',
        'input_tokens' => 'integer',
        'output_tokens' => 'integer',
    ];
}
