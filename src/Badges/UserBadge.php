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

namespace Ramon\Canela\Badges;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Notification\Notification;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Ramon\Canela\Badges\Notification\BadgeGrantedBlueprint;

/**
 * Uma concessão de emblema (`canela_user_badges`).
 *
 * @property int $id
 * @property int $user_id
 * @property int $badge_id
 * @property int|null $post_id
 * @property Carbon $granted_at
 * @property string|null $reason
 * @property int|null $granted_by_id
 * @property-read User|null $user
 * @property-read Badge|null $badge
 * @property-read Post|null $post
 * @property-read User|null $grantedBy
 */
final class UserBadge extends AbstractModel
{
    protected $table = 'canela_user_badges';

    protected $casts = [
        'user_id' => 'integer',
        'badge_id' => 'integer',
        'post_id' => 'integer',
        'granted_by_id' => 'integer',
        'granted_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        // Revogar leva junto o "Ganhou …" daquela concessão (a notificação
        // guarda o id dela nos dados, sem chave estrangeira).
        static::deleting(function (self $userBadge): void {
            Notification::query()
                ->where('type', BadgeGrantedBlueprint::getType())
                ->where('subject_id', $userBadge->badge_id)
                ->where('user_id', $userBadge->user_id)
                ->where('data', 'like', '%userBadgeId%')
                ->get()
                // O LIKE só separa as candidatas (o MySQL reformata o JSON); o id decide.
                ->filter(fn (Notification $notification) => (int) ($notification->data['userBadgeId'] ?? 0) === $userBadge->id)
                ->each(fn (Notification $notification) => $notification->delete());
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function badge(): BelongsTo
    {
        return $this->belongsTo(Badge::class);
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function grantedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'granted_by_id');
    }
}
