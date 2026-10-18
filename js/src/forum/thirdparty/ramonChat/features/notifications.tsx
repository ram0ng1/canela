/*
 * (5) Os alertas do chat no sino (extend/ramonchat.php, NotifyChatActivity):
 *
 * - `canelaRamonChatMention`: "mencionou você em #canal" (ou @here / @all);
 * - `canelaRamonChatMessage`: "escreveu em #canal" / "enviou uma mensagem
 *   direta", para quem acompanha o canal ("Para todas as atividades").
 *
 * O link abre a conversa na mensagem (`?message=`, ver permalink.ts), pelo
 * endereço da página cheia — o que também funciona numa aba nova. Ler o canal
 * marca os avisos dele como lidos (no servidor).
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import Notification from 'flarum/forum/components/Notification';
import type User from 'flarum/common/models/User';
import type ItemList from 'flarum/common/utils/ItemList';

import { component, ct, feature, rt } from './flags';
import { messagePath } from './permalink';
import { reviewHref } from './reviewData';

interface ActivityData {
  channelId: number;
  threadId: number | null;
  messageId: number;
  channelName: string | null;
  isDirect: boolean;
  kind?: 'user' | 'here' | 'all';
}

abstract class ActivityNotification extends Notification {
  data(): ActivityData {
    return (this.attrs.notification.content<ActivityData>() || {}) as ActivityData;
  }

  icon() {
    return 'far fa-message';
  }

  href() {
    const data = this.data();

    return messagePath(Number(data.channelId), Number(data.messageId), data.threadId);
  }

  sender(): string {
    const user = this.attrs.notification.fromUser() as User | false;

    return user ? user.displayName() : ct('deleted_chat_username');
  }

  channelLabel(): string {
    const data = this.data();

    if (!data.channelName) return ct('notifications.direct_message');

    return data.isDirect ? data.channelName : `#${data.channelName}`;
  }

  excerpt() {
    const subject: any = this.attrs.notification.subject();
    const text = String(subject?.content?.() || '');

    return text.length > 200 ? `${text.slice(0, 200)}…` : text;
  }
}

export class RamonChatMentionNotification extends ActivityNotification {
  icon() {
    return 'fas fa-at';
  }

  content() {
    const kind = this.data().kind || 'user';

    return ct(kind === 'user' ? 'notifications.mention' : `notifications.mention_${kind}`, { username: this.sender(), channel: this.channelLabel() });
  }
}

export class RamonChatMessageNotification extends ActivityNotification {
  content() {
    const data = this.data();

    if (data.isDirect && !data.channelName) return ct('notifications.direct_message_from', { username: this.sender() });

    return ct('notifications.message_in', { username: this.sender(), channel: this.channelLabel() });
  }
}

export default function installRamonChatNotifications(): void {
  app.notificationComponents.canelaRamonChatMention = RamonChatMentionNotification;
  app.notificationComponents.canelaRamonChatMessage = RamonChatMessageNotification;

  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: ItemList<any>) {
    if (!feature('bell') || !app.forum.attribute<boolean>('canUseChat')) return;

    items.add('canelaRamonChatMention', { name: 'canelaRamonChatMention', icon: 'fas fa-at', label: ct('notifications.settings_mention') });
    items.add('canelaRamonChatMessage', { name: 'canelaRamonChatMessage', icon: 'far fa-message', label: rt('notifications.settings_message') });
  });

  // O aviso "mensagem denunciada" do ramon/chat leva à fila "Revisar" do tema
  // (filtrada no chat), quando as denúncias do chat estão nela.
  override(component('MessageFlaggedNotification'), 'href', function (this: any, original: () => string) {
    return reviewHref() || original();
  });
}
