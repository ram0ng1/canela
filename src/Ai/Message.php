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
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Ramon\Canela\Support\Dates;

/**
 * Uma mensagem de uma conversa com a IA: a pergunta (`user`) ou a resposta
 * do bot (`assistant`), em Markdown.
 *
 * @property int $id
 * @property int $conversation_id
 * @property string $role
 * @property string $content
 * @property list<array<string, mixed>>|null $tools
 * @property string|null $model
 * @property int $input_tokens
 * @property int $output_tokens
 * @property Carbon $created_at
 */
final class Message extends AbstractModel
{
    public const ROLE_USER = 'user';

    public const ROLE_ASSISTANT = 'assistant';

    protected $table = 'canela_ai_messages';

    // Só created_at: uma mensagem não é editada.
    public $timestamps = false;

    protected $casts = [
        'id' => 'integer',
        'conversation_id' => 'integer',
        'tools' => 'array',
        'input_tokens' => 'integer',
        'output_tokens' => 'integer',
        'created_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class, 'conversation_id');
    }

    /** @return array<string, mixed> */
    public function toApiArray(): array
    {
        return [
            'id' => (string) $this->id,
            'role' => $this->role,
            'content' => $this->content,
            'tools' => $this->tools ?? [],
            'model' => $this->model,
            'createdAt' => Dates::atom($this->created_at),
        ];
    }
}
