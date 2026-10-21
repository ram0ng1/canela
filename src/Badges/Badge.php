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
use Flarum\Database\ScopeVisibilityTrait;
use Flarum\Locale\TranslatorInterface;
use Flarum\Notification\Notification;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Ramon\Canela\Badges\Notification\BadgeGrantedBlueprint;

/**
 * Um emblema (`canela_badges`).
 *
 * @property int $id
 * @property string $slug
 * @property string $name
 * @property string|null $description
 * @property string|null $long_description
 * @property string $icon
 * @property string|null $image_url
 * @property string $type
 * @property string $grouping
 * @property int $position
 * @property bool $multiple_grant
 * @property bool $enabled
 * @property bool $listable
 * @property bool $system
 * @property bool|null $allow_title
 * @property bool|null $manual_grant
 * @property Carbon|null $created_at
 */
final class Badge extends AbstractModel
{
    // Com a visibilidade registrada (extend/badges.php), a notificação de um
    // emblema desligado some do menu junto com o emblema.
    use ScopeVisibilityTrait;

    public const GOLD = 'gold';

    public const SILVER = 'silver';

    public const BRONZE = 'bronze';

    public const TYPES = [self::GOLD, self::SILVER, self::BRONZE];

    public $timestamps = true;

    public const UPDATED_AT = null;

    protected $table = 'canela_badges';

    protected $casts = [
        'position' => 'integer',
        'multiple_grant' => 'boolean',
        'enabled' => 'boolean',
        'listable' => 'boolean',
        'system' => 'boolean',
        'allow_title' => 'boolean',
        'manual_grant' => 'boolean',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        // As concessões vão junto pela chave estrangeira; as notificações
        // "Ganhou …" não têm chave, e ficariam órfãs no banco.
        static::deleting(function (self $badge): void {
            Notification::query()
                ->where('type', BadgeGrantedBlueprint::getType())
                ->where('subject_id', $badge->id)
                ->delete();
        });
    }

    public function userBadges(): HasMany
    {
        return $this->hasMany(UserBadge::class, 'badge_id');
    }

    /** Emblema do sistema com regra automática (os do sistema sempre têm uma). */
    public function isAutomatic(): bool
    {
        return $this->system && SystemBadges::isSystem($this->slug);
    }

    /**
     * Pode ser concedido à mão: os personalizados com a opção ligada. Os do
     * sistema são da regra automática.
     */
    public function isManuallyGrantable(): bool
    {
        if ($this->isAutomatic()) {
            return false;
        }

        // Antes da migração do admin a coluna não existe: personalizado é manual.
        return $this->manual_grant ?? true;
    }

    /**
     * O texto no idioma de quem lê.
     *
     * Os emblemas do sistema são traduzidos pelo slug enquanto o texto da
     * coluna for o da semente; editado no admin, vale o que o admin escreveu
     * (em qualquer idioma — é uma escolha do fórum). Os personalizados só têm
     * a coluna.
     */
    public function translated(TranslatorInterface $translator, string $field, array $parameters = []): ?string
    {
        $column = match ($field) {
            'name' => $this->name,
            'description' => $this->description,
            default => $this->long_description,
        };

        if (! $this->system) {
            return $column;
        }

        $edited = $field === 'long_description'
            ? $column !== null && $column !== ''
            : $column !== SystemBadges::defaultText($this->slug, $field);

        if ($edited) {
            return $column;
        }

        $key = "ramon-canela.api.badges.{$this->slug}.$field";
        $text = $translator->trans($key, $parameters);

        return $text === $key ? $column : $text;
    }
}
