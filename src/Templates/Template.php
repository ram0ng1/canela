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

namespace Ramon\Canela\Templates;

use Carbon\Carbon;
use Flarum\Database\AbstractModel;
use Flarum\Tags\Tag;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Um modelo do editor. O tipo (`kind`) vem de `required` ("sem texto livre"):
 *
 * - `text` (sem a trava): o texto entra no composer do tópico novo, e quem
 *   escreve muda o que quiser;
 * - `form` (com a trava): só os campos (`{{campo}}` no texto) são preenchidos,
 *   num formulário; o resto do texto sai como está. `fields` descreve cada
 *   campo (ver TemplateFields).
 *
 * Sem tags, vale em qualquer tópico novo; com tags, só nos tópicos que levam
 * uma delas. Onde um modelo com a trava vale, não há a opção de texto livre.
 *
 * @property int $id
 * @property string $name
 * @property string $kind
 * @property string $body
 * @property list<array<string, mixed>>|null $fields
 * @property bool $required
 * @property int $position
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Collection<int, Tag> $tags
 */
final class Template extends AbstractModel
{
    public const KINDS = ['text', 'form'];

    /** A tabela de ligação com as tags (sem chave estrangeira para `tags`). */
    public const PIVOT = 'canela_template_tag';

    protected $table = 'canela_templates';

    public $timestamps = true;

    protected $casts = [
        'id' => 'integer',
        'fields' => 'array',
        'required' => 'boolean',
        'position' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /** As tags em que o modelo vale (nenhuma: todas). Só com o flarum/tags. */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, self::PIVOT, 'template_id', 'tag_id');
    }

    public function isForm(): bool
    {
        return $this->kind === 'form';
    }
}
