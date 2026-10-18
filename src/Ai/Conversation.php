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

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Uma conversa com o bot de IA.
 *
 * @property int $id
 * @property int $user_id
 * @property string|null $title
 * @property string|null $persona
 * @property int $message_count
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User|null $user
 */
final class Conversation extends AbstractModel
{
    protected $table = 'canela_ai_conversations';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'message_count' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<Message, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(Message::class, 'conversation_id');
    }

    /** @return array<string, mixed> */
    public function toSummaryArray(): array
    {
        return [
            'id' => (string) $this->id,
            'title' => $this->title,
            'persona' => $this->persona,
            'messageCount' => $this->message_count,
            'createdAt' => $this->created_at?->toAtomString(),
            'updatedAt' => $this->updated_at?->toAtomString(),
        ];
    }
}
