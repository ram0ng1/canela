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

namespace Ramon\Canela\Events;

use Flarum\Discussion\Discussion;
use Flarum\Extension\ExtensionManager;
use Flarum\Settings\SettingsRepositoryInterface;

/**
 * As chaves dos eventos e as perguntas que o backend faz a elas.
 *
 * A tag dos eventos (`canela.events_tag`) decide onde o evento vale: com uma
 * tag escolhida, só as discussões dela mostram o cartão, aparecem em "Próximos
 * eventos" e recebem lembrete (o [event] numa discussão de outra tag fica só
 * como texto). Vazia, vale em qualquer discussão. Quem pode criar evento é
 * quem pode começar discussão na tag: a permissão é a da própria tag.
 */
final class EventsSettings
{
    public const ENABLED = 'canela.events_enabled';

    public const TAG = 'canela.events_tag';

    public const CHAT = 'canela.events_chat';

    public const DOCKED_CHAT = 'canela.events_docked_chat';

    public const LIST_BADGE = 'canela.events_list_badge';

    public const UPCOMING = 'canela.events_upcoming';

    public const REMINDER_MINUTES = 'canela.events_reminder_minutes';

    /** @var array<string, mixed> */
    public const DEFAULTS = [
        self::ENABLED => true,
        self::TAG => '',
        self::CHAT => true,
        self::DOCKED_CHAT => true,
        self::LIST_BADGE => true,
        self::UPCOMING => true,
        self::REMINDER_MINUTES => 15,
    ];

    public function __construct(
        private readonly SettingsRepositoryInterface $settings,
        private readonly ExtensionManager $extensions,
    ) {
    }

    public function enabled(): bool
    {
        return (bool) $this->settings->get(self::ENABLED, true);
    }

    public function on(string $key): bool
    {
        return $this->enabled() && (bool) $this->settings->get($key, self::DEFAULTS[$key] ?? false);
    }

    /** O id da tag dos eventos, ou null (qualquer discussão). */
    public function tagId(): ?int
    {
        $value = (int) $this->settings->get(self::TAG, '');

        return $value > 0 && $this->extensions->isEnabled('flarum-tags') ? $value : null;
    }

    public function reminderMinutes(): int
    {
        return max(0, min(10080, (int) $this->settings->get(self::REMINDER_MINUTES, 15)));
    }

    /** O chat do evento: chave ligada e o ramon/chat habilitado. */
    public function chatAvailable(): bool
    {
        return $this->on(self::CHAT) && $this->extensions->isEnabled('ramon-chat') && class_exists(\Ramon\Chat\Channel::class);
    }

    /** A discussão está onde os eventos valem. */
    public function appliesTo(Discussion $discussion): bool
    {
        $tagId = $this->tagId();

        if ($tagId === null) {
            return true;
        }

        if ($discussion->relationLoaded('tags')) {
            return $discussion->getRelation('tags')->contains('id', $tagId);
        }

        // Direto na tabela de ligação: a relação `tags` é posta pelo flarum/tags.
        return $discussion->getConnection()->table('discussion_tag')
            ->where('discussion_id', $discussion->id)
            ->where('tag_id', $tagId)
            ->exists();
    }
}
