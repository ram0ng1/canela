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

namespace Ramon\Canela\Extras\History;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Post\Post;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Uma edição de postagem: o texto que existia ANTES dela, quem editou e quando.
 *
 * Guardar o texto anterior (e não o novo) é o que permite montar todas as
 * versões sem duplicar a atual, que continua morando na própria postagem:
 * a versão 1 é o `content` da revisão 1; a versão N+1 é o da revisão N+1 ou,
 * depois da última, o texto atual do post.
 *
 * @property int $id
 * @property int $post_id
 * @property int|null $user_id
 * @property int $revision
 * @property string $content
 * @property Carbon $created_at
 * @property-read Post|null $post
 * @property-read User|null $user
 */
class PostRevision extends AbstractModel
{
    protected $table = 'canela_post_revisions';

    public $timestamps = false;

    protected $casts = [
        'id' => 'integer',
        'post_id' => 'integer',
        'user_id' => 'integer',
        'revision' => 'integer',
        'created_at' => 'datetime',
    ];

    /** @return BelongsTo<Post, $this> */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
