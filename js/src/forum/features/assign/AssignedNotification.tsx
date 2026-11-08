/* O alerta "Fulano atribuiu o tópico X a você" (tipo `canelaAssigned`). */
import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import username from 'flarum/common/helpers/username';
import type Discussion from 'flarum/common/models/Discussion';

import { t } from '../../utils/settings';

export default class AssignedNotification extends Notification {
  icon() {
    return 'fas fa-user-check';
  }

  href() {
    const discussion = this.attrs.notification.subject() as Discussion;

    return discussion ? app.route.discussion(discussion) : '';
  }

  content() {
    return t('assign.notification', { username: username(this.attrs.notification.fromUser()) });
  }

  excerpt() {
    return (this.attrs.notification.subject() as Discussion | null)?.title() ?? null;
  }
}
