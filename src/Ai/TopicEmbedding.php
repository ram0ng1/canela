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

/**
 * O vetor (embedding) de um tópico, para os tópicos relacionados.
 *
 * @property int $discussion_id
 * @property string $model
 * @property string $digest
 * @property string $vector base64 dos floats de 32 bits
 * @property Carbon $updated_at
 */
final class TopicEmbedding extends AbstractModel
{
    protected $table = 'canela_ai_embeddings';

    protected $primaryKey = 'discussion_id';

    public $incrementing = false;

    public $timestamps = false;

    protected $casts = [
        'discussion_id' => 'integer',
        'updated_at' => 'datetime',
    ];

    /**
     * @param list<float> $values
     */
    public static function pack(array $values): string
    {
        return base64_encode(pack('g*', ...$values));
    }

    /**
     * @return list<float>
     */
    public function values(): array
    {
        $binary = base64_decode($this->vector, true);

        return $binary === false || $binary === '' ? [] : array_values(unpack('g*', $binary) ?: []);
    }
}
