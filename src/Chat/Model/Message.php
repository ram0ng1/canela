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
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Uma mensagem do chat.
 *
 * @property int $id
 * @property int $channel_id
 * @property int|null $user_id
 * @property int|null $thread_id
 * @property int|null $in_reply_to_id
 * @property string $message
 * @property string $cooked
 * @property int|null $last_editor_id
 * @property Carbon|null $edited_at
 * @property Carbon|null $deleted_at
 * @property int|null $deleted_by_id
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read Channel|null $channel
 * @property-read User|null $user
 * @property-read User|null $deletedBy
 * @property-read Message|null $inReplyTo
 * @property-read Thread|null $thread
 * @property-read Pin|null $pin
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Reaction> $reactions
 * @property-read \Illuminate\Database\Eloquent\Collection<int, Upload> $uploads
 */
class Message extends AbstractModel
{
    /** O `chat_maximum_message_length` padrão do Discourse. */
    public const DEFAULT_MAX_LENGTH = 6000;

    protected $table = 'canela_chat_messages';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'channel_id' => 'integer',
        'user_id' => 'integer',
        'thread_id' => 'integer',
        'in_reply_to_id' => 'integer',
        'last_editor_id' => 'integer',
        'deleted_by_id' => 'integer',
        'edited_at' => 'datetime',
        'deleted_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function isDeleted(): bool
    {
        return $this->deleted_at !== null;
    }

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

    /**
     * @return BelongsTo<User, $this>
     */
    public function deletedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_by_id');
    }

    /**
     * @return BelongsTo<Message, $this>
     */
    public function inReplyTo(): BelongsTo
    {
        return $this->belongsTo(self::class, 'in_reply_to_id');
    }

    /**
     * @return BelongsTo<Thread, $this>
     */
    public function thread(): BelongsTo
    {
        return $this->belongsTo(Thread::class, 'thread_id');
    }

    /**
     * @return HasMany<Reaction, $this>
     */
    public function reactions(): HasMany
    {
        return $this->hasMany(Reaction::class, 'message_id');
    }

    /**
     * @return HasMany<Upload, $this>
     */
    public function uploads(): HasMany
    {
        return $this->hasMany(Upload::class, 'message_id');
    }

    /**
     * @return HasOne<Pin, $this>
     */
    public function pin(): HasOne
    {
        return $this->hasOne(Pin::class, 'message_id');
    }

    /**
     * @return HasMany<Mention, $this>
     */
    public function mentions(): HasMany
    {
        return $this->hasMany(Mention::class, 'message_id');
    }

    /** Se é a mensagem que abriu o fio (e não uma resposta dentro dele). */
    public function isThreadOriginal(): bool
    {
        return $this->thread_id !== null && $this->thread?->original_message_id === $this->id;
    }
}
