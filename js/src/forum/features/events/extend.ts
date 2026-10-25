/*
 * Extenders do fórum para os eventos: a página /events, o componente do
 * lembrete e os atributos que o PHP acrescenta aos posts e às discussões.
 */
import Extend from 'flarum/common/extenders';
import Discussion from 'flarum/common/models/Discussion';
import Post from 'flarum/common/models/Post';

import EventReminderNotification from './EventReminderNotification';
import { EVENTS_PATH, EVENTS_ROUTE } from './route';
import type { EventData, EventSummary } from './model';

// Página em chunk próprio: não pesa na primeira carga.
const EventsPage = () => import('./EventsPage');

export default [
  new Extend.Routes() //
    .add(EVENTS_ROUTE, EVENTS_PATH, EventsPage),

  new Extend.Notification() //
    .add('canelaEventReminder', EventReminderNotification),

  new Extend.Model(Post) //
    .attribute<EventData | null>('canelaEvent'),

  new Extend.Model(Discussion) //
    .attribute<EventSummary | null>('canelaEvent'),
];
