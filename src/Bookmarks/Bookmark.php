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

namespace Ramon\Canela\Bookmarks;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Database\ScopeVisibilityTrait;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Ramon\Canela\Bookmarks\Api\BookmarkBuffer;

/**
 * Um post marcado por um usuário.
 *
 * @property int $id
 * @property int $user_id
 * @property int $post_id
 * @property string|null $name
 * @property Carbon|null $reminder_at
 * @property Carbon|null $reminded_at
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property-read User|null $user
 * @property-read Post|null $post
 */
class Bookmark extends AbstractModel
{
    use ScopeVisibilityTrait;

    public const NAME_MAX_LENGTH = 100;

    protected $table = 'canela_bookmarks';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'post_id' => 'integer',
        'reminder_at' => 'datetime',
        'reminded_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    #[\Override]
    protected static function booted(): void
    {
        // Os atributos `bookmark*` dos posts vêm de um buffer por requisição.
        // Criar ou apagar um marcador no meio dela (a resposta do POST inclui o
        // post) não pode devolver o estado de antes.
        $forget = static fn (self $bookmark) => BookmarkBuffer::forget($bookmark->user_id, $bookmark->post_id);

        static::saved($forget);
        static::deleted($forget);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Post, $this>
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /**
     * Troca o horário do lembrete. Um horário novo volta a valer: o envio do
     * anterior (`reminded_at`) é esquecido, ou o comando nunca o mandaria.
     */
    public function setReminder(?\DateTimeInterface $at): void
    {
        $next = $at === null ? null : Carbon::instance($at)->utc()->startOfMinute();
        $current = $this->reminder_at;

        // O mesmo horário (o front-end reenvia o que já estava) não é um
        // lembrete novo: um que já foi enviado não deve voltar a disparar.
        if ($next === null ? $current === null : ($current !== null && $next->equalTo($current))) {
            return;
        }

        $this->reminder_at = $next;
        $this->reminded_at = null;
    }

    public function setName(?string $name): void
    {
        $name = trim((string) $name);

        $this->name = $name === '' ? null : mb_substr($name, 0, self::NAME_MAX_LENGTH);
    }
}
