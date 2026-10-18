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
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $thread_id
 * @property int $user_id
 * @property int|null $last_read_message_id
 * @property int $notification_level
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read Thread|null $thread
 */
class ThreadMembership extends AbstractModel
{
    protected $table = 'canela_chat_thread_memberships';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'thread_id' => 'integer',
        'user_id' => 'integer',
        'last_read_message_id' => 'integer',
        'notification_level' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Thread, $this>
     */
    public function thread(): BelongsTo
    {
        return $this->belongsTo(Thread::class, 'thread_id');
    }
}
