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

namespace Ramon\Canela\Events\Access;

use Flarum\Discussion\Discussion;
use Flarum\User\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Ramon\Canela\Events\EventsSettings;

/**
 * `CalendarEvent::whereVisibleTo($actor)`: o evento só existe para quem vê a
 * discussão dele, e só onde os eventos valem (a tag escolhida no admin). Para
 * os outros, ele some da agenda e responde 404 — como a própria discussão.
 */
final class ScopeCalendarEventVisibility
{
    public function __construct(
        private readonly EventsSettings $settings,
    ) {
    }

    public function __invoke(User $actor, Builder $query): void
    {
        $visible = Discussion::whereVisibleTo($actor)->select('discussions.id');
        $tagId = $this->settings->tagId();

        if ($tagId !== null) {
            $visible->whereIn('discussions.id', static fn (QueryBuilder $tagged) => $tagged->select('discussion_id')->from('discussion_tag')->where('tag_id', $tagId));
        }

        $query->whereIn('canela_events.discussion_id', $visible);
    }
}
