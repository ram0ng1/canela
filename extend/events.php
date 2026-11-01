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

/*
 * Eventos: o [event] no primeiro post, com presença (vou,
 * interessado, não vou), recorrência, lembrete, a data na lista e no cabeçalho
 * do tópico, "Próximos eventos" e, com o ramon/chat, o canal de chat do evento
 * ao lado do tópico.
 *
 * A tag escolhida no admin (EventsSettings::TAG) diz onde os eventos valem;
 * vazia, em qualquer discussão. Tudo fica registrado com o recurso desligado
 * (as rotas são montadas no boot, antes das configurações), e cada ponto de
 * entrada consulta EventsSettings: desligado, a rota responde 404 e o campo
 * some. O formatador vale a partir do próximo "limpar cache".
 */

use Flarum\Api\Endpoint;
use Flarum\Api\Resource\DiscussionResource;
use Flarum\Api\Resource\PostResource;
use Flarum\Discussion\Discussion;
use Flarum\Extend;
use Flarum\Post\Event\Posted;
use Flarum\Post\Event\Revised;
use Ramon\Canela\Events\Access\CalendarEventPolicy;
use Ramon\Canela\Events\Access\ScopeCalendarEventVisibility;
use Ramon\Canela\Events\Api\CalendarEventResource;
use Ramon\Canela\Events\Api\EventFields;
use Ramon\Canela\Events\CalendarEvent;
use Ramon\Canela\Events\Console\ReminderSchedule;
use Ramon\Canela\Events\Console\SendEventReminders;
use Ramon\Canela\Events\EventsSettings;
use Ramon\Canela\Events\Formatter\EventTag;
use Ramon\Canela\Events\Listener\SyncPostEvent;
use Ramon\Canela\Events\Notification\EventReminderBlueprint;

$settings = (new Extend\Settings())
    // O fórum só mostra os eventos com este arquivo carregado: o atributo é a prova.
    ->default('canela.events_backend', true)
    ->serializeToForum('canelaEventsBackend', 'canela.events_backend', static fn (): bool => true);

foreach (EventsSettings::DEFAULTS as $key => $default) {
    $settings->default($key, $default);
}

$settings
    ->serializeToForum('canelaEventsEnabled', EventsSettings::ENABLED, 'boolval')
    ->serializeToForum('canelaEventsTag', EventsSettings::TAG, 'strval')
    ->serializeToForum('canelaEventsChat', EventsSettings::CHAT, 'boolval')
    ->serializeToForum('canelaEventsDockedChat', EventsSettings::DOCKED_CHAT, 'boolval')
    ->serializeToForum('canelaEventsListBadge', EventsSettings::LIST_BADGE, 'boolval')
    ->serializeToForum('canelaEventsUpcoming', EventsSettings::UPCOMING, 'boolval');

return [
    $settings,

    (new Extend\Formatter())
        ->configure(static function (s9e\TextFormatter\Configurator $config): void {
            (new EventTag())($config);
        }),

    (new Extend\Model(Discussion::class))
        ->hasOne('canelaEvent', CalendarEvent::class, 'discussion_id'),

    (new Extend\Event())
        ->listen(Posted::class, SyncPostEvent::class)
        ->listen(Revised::class, SyncPostEvent::class),

    // A discussão incluída nos posts (a página do tópico) também lê o evento:
    // sem isto, uma consulta a mais por discussão. Desligado, nada carrega.
    (new Extend\ApiResource(PostResource::class))
        ->fields(EventFields::post(...))
        ->endpoint([Endpoint\Index::class, Endpoint\Show::class], static fn (Endpoint\Index|Endpoint\Show $endpoint) => $endpoint->eagerLoad(
            static fn (array $included): array => in_array('discussion', $included, true) && resolve(EventsSettings::class)->enabled() ? ['discussion.canelaEvent'] : []
        )),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(EventFields::discussion(...))
        ->endpoint([Endpoint\Index::class, Endpoint\Show::class], static fn (Endpoint\Index|Endpoint\Show $endpoint) => $endpoint->eagerLoad(
            static fn (): array => resolve(EventsSettings::class)->enabled() ? ['canelaEvent'] : []
        )),

    // A página /events (lista e calendário) abre direto pelo endereço.
    (new Extend\Frontend('forum'))
        ->route('/events', 'canela.events'),

    // A agenda, o cartão, a presença e os convidados: o recurso JSON:API, com
    // a visibilidade da discussão e a habilidade de responder (policy).
    new Extend\ApiResource(CalendarEventResource::class),

    (new Extend\ModelVisibility(CalendarEvent::class))
        ->scope(ScopeCalendarEventVisibility::class),

    (new Extend\Policy())
        ->modelPolicy(CalendarEvent::class, CalendarEventPolicy::class),

    // Só o alerta, ligado por padrão; cada pessoa desliga em Configurações.
    (new Extend\Notification())
        ->type(EventReminderBlueprint::class, ['alert']),

    (new Extend\Console())
        ->command(SendEventReminders::class)
        ->schedule(SendEventReminders::class, ReminderSchedule::class),
];
