/*
 * O alerta "O evento X começa às 10:00" (tipo `canelaEventReminder`), mandado
 * pelo comando agendado a quem marcou "Vou". Leva à discussão do evento.
 */
import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import type Discussion from 'flarum/common/models/Discussion';

import { dayAndTime } from './format';
import { t } from '../../utils/settings';

interface ReminderContent {
  eventId?: number;
  name?: string | null;
  startsAt?: string | null;
}

export default class EventReminderNotification extends Notification {
  icon() {
    return 'far fa-calendar';
  }

  discussion(): Discussion | null {
    return (this.attrs.notification.subject() as Discussion | null | false) || null;
  }

  href() {
    const discussion = this.discussion();

    return discussion ? app.route.discussion(discussion) : '';
  }

  content() {
    const data = (this.attrs.notification.content<ReminderContent | null>() || {}) as ReminderContent;
    const name = data.name || this.discussion()?.title() || '';
    const when = data.startsAt ? dayAndTime(new Date(data.startsAt)) : '';

    return t('events.notification.text', { name, when });
  }

  excerpt() {
    return null;
  }
}
