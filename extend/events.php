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
use Ramon\Canela\Events\Api\EventController;
use Ramon\Canela\Events\Api\EventFields;
use Ramon\Canela\Events\Api\UpcomingController;
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

    (new Extend\ApiResource(PostResource::class))
        ->fields(EventFields::post(...)),

    (new Extend\ApiResource(DiscussionResource::class))
        ->fields(EventFields::discussion(...))
        ->endpoint([Endpoint\Index::class, Endpoint\Show::class], static fn (Endpoint\Index|Endpoint\Show $endpoint) => $endpoint->eagerLoad(['canelaEvent'])),

    // A página /events (lista e calendário) abre direto pelo endereço.
    (new Extend\Frontend('forum'))
        ->route('/events', 'canela.events'),

    (new Extend\Routes('api'))
        ->get('/canela-events', 'canela.events.upcoming', UpcomingController::class)
        ->get('/canela-events/{id:\d+}/invitees', 'canela.events.invitees', EventController::class)
        ->post('/canela-events/{id:\d+}/rsvp', 'canela.events.rsvp', EventController::class),

    // Só o alerta, ligado por padrão; cada pessoa desliga em Configurações.
    (new Extend\Notification())
        ->type(EventReminderBlueprint::class, ['alert']),

    (new Extend\Console())
        ->command(SendEventReminders::class)
        ->schedule(SendEventReminders::class, ReminderSchedule::class),
];
