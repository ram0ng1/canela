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

namespace Ramon\Canela\Events\Api;

use Flarum\Api\Context;
use Flarum\Api\Schema;
use Flarum\Discussion\Discussion;
use Flarum\Post\Post;
use Ramon\Canela\Events\CalendarEvent;
use Ramon\Canela\Events\EventPresenter;
use Ramon\Canela\Events\EventsSettings;

/**
 * O evento na API: o cartão inteiro no primeiro post (`canelaEvent` do post) e
 * o resumo na discussão (a data na lista e no cabeçalho do tópico).
 *
 * Só onde os eventos valem (a tag escolhida no admin). O post consulta a
 * tabela uma vez, e só para o primeiro post; a discussão lê a relação que o
 * Index carrega de uma vez (eagerLoad em extend/events.php).
 */
final class EventFields
{
    /**
     * @return array<int, Schema\Arr>
     */
    public static function post(): array
    {
        return [
            Schema\Arr::make('canelaEvent')
                ->nullable()
                ->visible(static fn (Post $post): bool => (int) $post->number === 1 && resolve(EventsSettings::class)->enabled())
                ->get(static function (Post $post, Context $context): ?array {
                    /** @var CalendarEvent|null $event */
                    $event = CalendarEvent::query()->with('user')->where('post_id', $post->id)->first();

                    if (! $event || ! $post->discussion || ! resolve(EventsSettings::class)->appliesTo($post->discussion)) {
                        return null;
                    }

                    return resolve(EventPresenter::class)->full($event, $context->getActor());
                }),
        ];
    }

    /**
     * @return array<int, Schema\Arr>
     */
    public static function discussion(): array
    {
        return [
            Schema\Arr::make('canelaEvent')
                ->nullable()
                ->visible(static fn (): bool => resolve(EventsSettings::class)->enabled())
                ->get(static function (Discussion $discussion): ?array {
                    /** @var CalendarEvent|null $event */
                    $event = $discussion->getRelationValue('canelaEvent');

                    if (! $event || ! resolve(EventsSettings::class)->appliesTo($discussion)) {
                        return null;
                    }

                    return resolve(EventPresenter::class)->summary($event);
                }),
        ];
    }
}
