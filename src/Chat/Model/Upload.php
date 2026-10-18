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

/**
 * Uma imagem enviada pelo composer do chat.
 *
 * @property int $id
 * @property int|null $user_id
 * @property int|null $message_id
 * @property string $path
 * @property string $original_name
 * @property string $mime
 * @property int $size
 * @property int|null $width
 * @property int|null $height
 * @property Carbon|null $created_at
 */
class Upload extends AbstractModel
{
    /** Anexos por mensagem — o Discourse também limita o composer. */
    public const MAX_PER_MESSAGE = 10;

    protected $table = 'canela_chat_uploads';

    public $timestamps = false;

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'message_id' => 'integer',
        'size' => 'integer',
        'width' => 'integer',
        'height' => 'integer',
        'created_at' => 'datetime',
    ];
}
