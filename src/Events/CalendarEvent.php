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

namespace Ramon\Canela\Events;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Database\ScopeVisibilityTrait;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * O evento do primeiro post de uma discussão (o `[event]`).
 *
 * As datas ficam em UTC. Com recorrência, `starts_at`/`ends_at` são a primeira
 * ocorrência, e a de agora sai de Recurrence::current().
 *
 * @property int $id
 * @property int $post_id
 * @property int $discussion_id
 * @property int|null $user_id
 * @property string|null $name
 * @property Carbon $starts_at
 * @property Carbon|null $ends_at
 * @property string|null $timezone
 * @property string $status
 * @property string|null $recurrence
 * @property Carbon|null $recurrence_until
 * @property string|null $url
 * @property string|null $location
 * @property string|null $description
 * @property int|null $max_attendees
 * @property bool $chat_enabled
 * @property int|null $chat_channel_id
 * @property int $going_count
 * @property int $interested_count
 * @property int $not_going_count
 * @property Carbon|null $reminded_start
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read Post|null $post
 * @property-read Discussion|null $discussion
 * @property-read User|null $user
 */
class CalendarEvent extends AbstractModel
{
    use ScopeVisibilityTrait;

    public const STATUS_PUBLIC = 'public';

    public const STATUS_STANDALONE = 'standalone';

    protected $table = 'canela_events';

    /**
     * As ocorrências no intervalo que a agenda pediu (CalendarEventResource),
     * em ordem. Só existe na resposta da agenda: não é coluna, nunca é gravado.
     *
     * @var list<array{startsAt: string, endsAt: string|null}>|null
     */
    public ?array $agendaOccurrences = null;

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'post_id' => 'integer',
        'discussion_id' => 'integer',
        'user_id' => 'integer',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'recurrence_until' => 'datetime',
        'max_attendees' => 'integer',
        'chat_enabled' => 'boolean',
        'chat_channel_id' => 'integer',
        'going_count' => 'integer',
        'interested_count' => 'integer',
        'not_going_count' => 'integer',
        'reminded_start' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Post, $this>
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /**
     * @return BelongsTo<Discussion, $this>
     */
    public function discussion(): BelongsTo
    {
        return $this->belongsTo(Discussion::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<EventInvitee, $this>
     */
    public function invitees(): HasMany
    {
        return $this->hasMany(EventInvitee::class, 'event_id');
    }

    /** Aceita presença (o "standalone" é só o aviso). */
    public function hasRsvp(): bool
    {
        return $this->status !== self::STATUS_STANDALONE;
    }

    /** Recalcula os três contadores pela tabela de convidados. */
    public function refreshCounts(): void
    {
        $counts = EventInvitee::query()
            ->where('event_id', $this->id)
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $this->going_count = (int) ($counts[EventInvitee::GOING] ?? 0);
        $this->interested_count = (int) ($counts[EventInvitee::INTERESTED] ?? 0);
        $this->not_going_count = (int) ($counts[EventInvitee::NOT_GOING] ?? 0);
    }
}
