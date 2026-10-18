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
use Flarum\Discussion\Discussion;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * O resumo de IA de um tópico (o completo e o curto, da lista).
 *
 * @property int $discussion_id
 * @property string|null $summary
 * @property int|null $summary_post_number
 * @property int|null $summary_post_count
 * @property string|null $summary_model
 * @property Carbon|null $summary_updated_at
 * @property string|null $gist
 * @property int|null $gist_post_number
 * @property Carbon|null $gist_updated_at
 */
final class TopicSummary extends AbstractModel
{
    protected $table = 'canela_ai_summaries';

    protected $primaryKey = 'discussion_id';

    public $incrementing = false;

    public $timestamps = false;

    protected $casts = [
        'discussion_id' => 'integer',
        'summary_post_number' => 'integer',
        'summary_post_count' => 'integer',
        'summary_updated_at' => 'datetime',
        'gist_post_number' => 'integer',
        'gist_updated_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Discussion, $this>
     */
    public function discussion(): BelongsTo
    {
        return $this->belongsTo(Discussion::class);
    }
}
