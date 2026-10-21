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

namespace Ramon\Canela\Chat\Model;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;

/**
 * @property int $id
 * @property int $message_id
 * @property int $user_id
 * @property string $emoji
 * @property Carbon|null $created_at
 */
class Reaction extends AbstractModel
{
    /** Emojis diferentes por mensagem. */
    public const MAX_PER_MESSAGE = 30;

    protected $table = 'canela_chat_reactions';

    public $timestamps = false;

    protected $casts = [
        'id' => 'integer',
        'message_id' => 'integer',
        'user_id' => 'integer',
        'created_at' => 'datetime',
    ];
}
