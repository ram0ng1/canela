/*
 * O alerta "Lembrete do marcador" (tipo `canelaBookmarkReminder`), mandado
 * pelo comando agendado quando o horário escolhido chega. Leva ao post
 * marcado; o trecho é o nome do marcador, ou o começo do post sem nome.
 */
import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import { truncate } from 'flarum/common/utils/string';
import type Post from 'flarum/common/models/Post';

import { t } from '../../../utils/settings';

interface ReminderContent {
  bookmarkId?: number;
  name?: string | null;
  reminderAt?: string | null;
}

export default class BookmarkReminderNotification extends Notification {
  icon() {
    return 'fas fa-bookmark';
  }

  post(): Post | null {
    return (this.attrs.notification.subject() as Post | null | false) || null;
  }

  href() {
    const post = this.post();

    return post ? app.route.post(post) : '';
  }

  content() {
    const discussion = this.post()?.discussion();

    return t('bookmarks.notification.text', { title: discussion ? discussion.title() : '' });
  }

  excerpt() {
    const data = (this.attrs.notification.content<ReminderContent | null>() || {}) as ReminderContent;

    if (data.name) return data.name;

    const plain = this.post()?.contentPlain();

    return plain ? truncate(plain, 200) : null;
  }
}
