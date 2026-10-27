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

namespace Ramon\Canela\Gaps\Invites;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Database\ScopeVisibilityTrait;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Um link de convite: código, quem convidou, validade e usos.
 *
 * @property int $id
 * @property string $code
 * @property int $user_id
 * @property int $max_redemptions
 * @property int $redemption_count
 * @property Carbon|null $expires_at
 * @property Carbon|null $created_at
 * @property-read User|null $user
 */
final class Invite extends AbstractModel
{
    use ScopeVisibilityTrait;

    protected $table = 'canela_invites';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'max_redemptions' => 'integer',
        'redemption_count' => 'integer',
        'expires_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Ainda vale: dentro da validade e com usos sobrando. */
    public function isUsable(): bool
    {
        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }

        return $this->redemption_count < $this->max_redemptions;
    }
}
