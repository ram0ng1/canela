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
 * A participação de uma pessoa num canal: se entrou, se silenciou, o nível de
 * notificação, a estrela e até onde leu.
 *
 * @property int $id
 * @property int $channel_id
 * @property int $user_id
 * @property bool $following
 * @property bool $muted
 * @property int $notification_level
 * @property bool $starred
 * @property int|null $last_read_message_id
 * @property Carbon|null $last_viewed_at
 * @property Carbon|null $last_viewed_pins_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read Channel|null $channel
 * @property-read User|null $user
 */
class Membership extends AbstractModel
{
    public const NOTIFY_NEVER = 0;

    public const NOTIFY_MENTION = 1;

    public const NOTIFY_ALWAYS = 2;

    public const LEVEL_NAMES = [
        self::NOTIFY_NEVER => 'never',
        self::NOTIFY_MENTION => 'mention',
        self::NOTIFY_ALWAYS => 'always',
    ];

    protected $table = 'canela_chat_memberships';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'channel_id' => 'integer',
        'user_id' => 'integer',
        'following' => 'boolean',
        'muted' => 'boolean',
        'notification_level' => 'integer',
        'starred' => 'boolean',
        'last_read_message_id' => 'integer',
        'last_viewed_at' => 'datetime',
        'last_viewed_pins_at' => 'datetime',
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
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function levelName(): string
    {
        return self::LEVEL_NAMES[$this->notification_level] ?? 'mention';
    }
}
