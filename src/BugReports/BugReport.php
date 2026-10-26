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

namespace Ramon\Canela\BugReports;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Um relatório: a área marcada na tela, o que a pessoa escreveu e o contexto
 * da página (URL, tela, elementos sob a área, erros do console).
 *
 * @property int $id
 * @property int|null $user_id
 * @property string $kind
 * @property string $status
 * @property string $description
 * @property string|null $current_text
 * @property string|null $suggested_text
 * @property string $url
 * @property string $title
 * @property array<string, mixed>|null $context
 * @property string|null $region_path
 * @property string|null $full_path
 * @property string|null $admin_note
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property User|null $user
 */
final class BugReport extends AbstractModel
{
    public const KINDS = ['bug', 'content', 'design', 'idea'];

    public const STATUSES = ['open', 'reviewed', 'in_progress', 'fixed', 'wontfix'];

    protected $table = 'canela_bug_reports';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'user_id' => 'integer',
        'context' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Ainda pede atenção (não foi resolvido nem descartado). */
    public function isActive(): bool
    {
        return ! in_array($this->status, ['fixed', 'wontfix'], true);
    }
}
