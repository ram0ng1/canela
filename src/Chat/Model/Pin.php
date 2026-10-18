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
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $channel_id
 * @property int $message_id
 * @property int|null $pinned_by_id
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User|null $pinnedBy
 * @property-read Message|null $message
 */
class Pin extends AbstractModel
{
    /** O `MAX_PINS_PER_CHANNEL` do Discourse. */
    public const MAX_PER_CHANNEL = 20;

    protected $table = 'canela_chat_pins';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'channel_id' => 'integer',
        'message_id' => 'integer',
        'pinned_by_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function pinnedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pinned_by_id');
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'message_id');
    }
}
