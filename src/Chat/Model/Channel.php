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
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Um canal do chat: público (avulso ou ligado a uma tag) ou mensagem direta.
 *
 * @property int $id
 * @property string $type
 * @property int|null $tag_id
 * @property string|null $name
 * @property string|null $slug
 * @property string|null $description
 * @property string|null $emoji
 * @property int $status
 * @property bool $threading_enabled
 * @property bool $allow_channel_wide_mentions
 * @property bool $auto_join
 * @property bool $is_group
 * @property string|null $direct_key
 * @property int|null $last_message_id
 * @property int $messages_count
 * @property int $user_count
 * @property int|null $created_by_id
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read Message|null $lastMessage
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Membership> $memberships
 */
class Channel extends AbstractModel
{
    public const TYPE_PUBLIC = 'public';

    public const TYPE_DIRECT = 'direct';

    public const STATUS_OPEN = 0;

    public const STATUS_READ_ONLY = 1;

    public const STATUS_CLOSED = 2;

    public const STATUS_ARCHIVED = 3;

    /** Os nomes que a API usa, na ordem dos códigos. */
    public const STATUS_NAMES = [
        self::STATUS_OPEN => 'open',
        self::STATUS_READ_ONLY => 'read_only',
        self::STATUS_CLOSED => 'closed',
        self::STATUS_ARCHIVED => 'archived',
    ];

    /** Como o `max_topic_title_length` padrão do Discourse. */
    public const NAME_MAX_LENGTH = 100;

    public const DESCRIPTION_MAX_LENGTH = 500;

    protected $table = 'canela_chat_channels';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'tag_id' => 'integer',
        'status' => 'integer',
        'threading_enabled' => 'boolean',
        'allow_channel_wide_mentions' => 'boolean',
        'auto_join' => 'boolean',
        'is_group' => 'boolean',
        'last_message_id' => 'integer',
        'messages_count' => 'integer',
        'user_count' => 'integer',
        'created_by_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function isDirect(): bool
    {
        return $this->type === self::TYPE_DIRECT;
    }

    public function isPublic(): bool
    {
        return $this->type === self::TYPE_PUBLIC;
    }

    public function statusName(): string
    {
        return self::STATUS_NAMES[$this->status] ?? 'open';
    }

    /**
     * @return HasMany<Membership, $this>
     */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class, 'channel_id');
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'channel_id');
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function lastMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    /**
     * A chave das mensagens diretas: os participantes em ordem, sem repetição.
     *
     * @param int[] $userIds
     */
    public static function directKey(array $userIds): string
    {
        $ids = array_values(array_unique(array_map('intval', $userIds)));
        sort($ids);

        return implode(',', $ids);
    }
}
