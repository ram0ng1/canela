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
use Flarum\Database\ScopeVisibilityTrait;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Um fio: as respostas a uma mensagem, numa conversa à parte.
 *
 * @property int $id
 * @property int $channel_id
 * @property int $original_message_id
 * @property int|null $original_message_user_id
 * @property string|null $title
 * @property int|null $last_message_id
 * @property int $replies_count
 * @property int $status
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read Channel|null $channel
 * @property-read Message|null $originalMessage
 * @property-read Message|null $lastMessage
 */
class Thread extends AbstractModel
{
    use ScopeVisibilityTrait;

    public const TITLE_MAX_LENGTH = 100;

    public const LEVEL_MUTED = 0;

    public const LEVEL_NORMAL = 1;

    public const LEVEL_TRACKING = 2;

    public const LEVEL_WATCHING = 3;

    public const LEVEL_NAMES = [
        self::LEVEL_MUTED => 'muted',
        self::LEVEL_NORMAL => 'regular',
        self::LEVEL_TRACKING => 'tracking',
        self::LEVEL_WATCHING => 'watching',
    ];

    protected $table = 'canela_chat_threads';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'channel_id' => 'integer',
        'original_message_id' => 'integer',
        'original_message_user_id' => 'integer',
        'last_message_id' => 'integer',
        'replies_count' => 'integer',
        'status' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Channel, $this>
     */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class, 'channel_id');
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function originalMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'original_message_id');
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function lastMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }

    /**
     * @return HasMany<ThreadMembership, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(ThreadMembership::class, 'thread_id');
    }
}
