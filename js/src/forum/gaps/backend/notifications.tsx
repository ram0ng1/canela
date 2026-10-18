/*
 * As notificações do Discourse que o Flarum não tinha, geradas pelo
 * backend dos recursos (extend/gaps.php):
 *
 * - "Fulano editou sua postagem" (edited);
 * - "Fulano vinculou seu tópico" (linked);
 * - "Fulano aceitou seu convite" (invitee_accepted).
 *
 * E as linhas delas em Configurações → Notificações, só quando o backend
 * está carregado (sem ele o tipo não existe no servidor).
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Notification from 'flarum/forum/components/Notification';
import { truncate } from 'flarum/common/utils/string';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type ItemList from 'flarum/common/utils/ItemList';

import { gapsBackend } from '../settings';
import { forumBool, t } from '../../utils/settings';

function postSubject(notification: any): Post | null {
  const subject = notification.subject();

  return subject && typeof subject.discussion === 'function' ? (subject as Post) : null;
}

export class PostEditedNotification extends Notification {
  icon() {
    return 'fas fa-pencil';
  }

  href() {
    const post = postSubject(this.attrs.notification);

    return post ? app.route.post(post) : app.route('index');
  }

  content() {
    const user = this.attrs.notification.fromUser();

    return t('gaps.notifications.post_edited', { username: user ? user.displayName() : '' });
  }

  excerpt() {
    const post = postSubject(this.attrs.notification);
    const discussion = post?.discussion();

    return discussion ? discussion.title() : null;
  }
}

export class TopicLinkedNotification extends Notification {
  icon() {
    return 'fas fa-link';
  }

  href() {
    const post = postSubject(this.attrs.notification);

    return post ? app.route.post(post) : app.route('index');
  }

  content() {
    const user = this.attrs.notification.fromUser();

    return t('gaps.notifications.topic_linked', { username: user ? user.displayName() : '' });
  }

  excerpt() {
    const post = postSubject(this.attrs.notification);
    const discussion = post?.discussion();

    return discussion ? truncate(discussion.title(), 120) : null;
  }
}

export class InviteAcceptedNotification extends Notification {
  icon() {
    return 'fas fa-user-plus';
  }

  href() {
    const user = this.attrs.notification.subject() as unknown as User | false;

    return user && typeof (user as any).slug === 'function' ? app.route.user(user) : app.route('index');
  }

  content() {
    const user = this.attrs.notification.fromUser();

    return t('gaps.notifications.invite_accepted', { username: user ? user.displayName() : '' });
  }

  excerpt() {
    return null;
  }
}

export default function installGapNotifications(): void {
  // Pelo nome do módulo: o NotificationGrid vem no pedaço da página de
  // configurações, carregado sob demanda.
  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: ItemList<any>) {
    if (!gapsBackend()) return;

    if (forumBool('canelaNotifyPostEdited', true)) {
      items.add('canelaPostEdited', { name: 'canelaPostEdited', icon: 'fas fa-pencil', label: t('gaps.notifications.post_edited_setting') });
    }

    if (forumBool('canelaNotifyTopicLinked', true)) {
      items.add('canelaTopicLinked', { name: 'canelaTopicLinked', icon: 'fas fa-link', label: t('gaps.notifications.topic_linked_setting') });
    }

    if (forumBool('canelaInvitesEnabled', true)) {
      items.add('canelaInviteAccepted', {
        name: 'canelaInviteAccepted',
        icon: 'fas fa-user-plus',
        label: t('gaps.notifications.invite_accepted_setting'),
      });
    }
  });
}
