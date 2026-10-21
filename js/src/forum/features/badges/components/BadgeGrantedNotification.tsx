import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';

import type Badge from '../models/Badge';
import { badgeUrl } from '../utils';
import { t } from '../../../utils/settings';

/**
 * 'Ganhou "Primeira curtida"' — a notificação de emblema concedido. O avatar é o
 * da própria pessoa (o servidor manda ela como remetente), com o ícone de
 * emblema no canto.
 */
export default class BadgeGrantedNotification extends Notification {
  icon() {
    return 'fas fa-certificate';
  }

  href() {
    const badge = this.attrs.notification.subject() as unknown as Badge | false;
    const username = app.session.user?.username();

    return badge ? badgeUrl(badge, username) : app.route('canela.badges');
  }

  content() {
    const badge = this.attrs.notification.subject() as unknown as Badge | false;

    return t('badges.notification', { badge: badge ? badge.name() : '' });
  }

  excerpt() {
    const badge = this.attrs.notification.subject() as unknown as Badge | false;

    return badge ? badge.description() : null;
  }
}
