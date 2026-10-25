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
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A resposta de uma pessoa a um evento.
 *
 * @property int $id
 * @property int $event_id
 * @property int $user_id
 * @property string $status
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read CalendarEvent|null $event
 * @property-read User|null $user
 */
class EventInvitee extends AbstractModel
{
    public const GOING = 'going';

    public const INTERESTED = 'interested';

    public const NOT_GOING = 'not_going';

    public const STATUSES = [self::GOING, self::INTERESTED, self::NOT_GOING];

    protected $table = 'canela_event_invitees';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'event_id' => 'integer',
        'user_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<CalendarEvent, $this>
     */
    public function event(): BelongsTo
    {
        return $this->belongsTo(CalendarEvent::class, 'event_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
