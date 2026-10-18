/*
 * Os alertas do chat no menu de notificações:
 *
 * - `canelaChatMention`: "mencionou você em #canal" (o `chat_mention`);
 * - `canelaChatMessage`: "Nova mensagem de chat", da MD (ou do canal em "Para
 *   todas as atividades").
 *
 * O link abre a conversa na mensagem, pela URL da página cheia — o que também
 * funciona numa aba nova e no e-mail.
 */
import app from 'flarum/forum/app';
import Notification from 'flarum/forum/components/Notification';
import type User from 'flarum/common/models/User';

import { ct } from './flags';

interface MentionData {
  channelId: number;
  messageId: number;
  threadId: number | null;
  channelTitle: string;
  slug: string;
  kind: 'user' | 'here' | 'all';
}

interface MessageData {
  channelId: number;
  slug: string;
  isDirect: boolean;
  name: string | null;
}

function channelUrl(slug: string, id: number): string {
  return app.route('canela.chat.channel', { slug: slug || '-', id });
}

export class ChatMentionNotification extends Notification {
  data(): MentionData {
    return (this.attrs.notification.content<MentionData>() || {}) as MentionData;
  }

  icon() {
    return 'far fa-message';
  }

  href() {
    const data = this.data();
    const base = channelUrl(data.slug, data.channelId);

    return data.threadId ? `${base}/t/${data.threadId}/${data.messageId}` : `${base}/${data.messageId}`;
  }

  content() {
    const data = this.data();
    const user = this.attrs.notification.fromUser() as User | false;

    return ct(data.kind === 'user' || !data.kind ? 'notifications.mention' : `notifications.mention_${data.kind}`, {
      username: user ? user.displayName() : '',
      channel: data.channelTitle ? `#${data.channelTitle}` : ct('notifications.direct_message'),
    });
  }

  excerpt() {
    return null;
  }
}

export class ChatMessageNotification extends Notification {
  data(): MessageData {
    return (this.attrs.notification.content<MessageData>() || {}) as MessageData;
  }

  icon() {
    return 'far fa-message';
  }

  href() {
    const data = this.data();

    return channelUrl(data.slug, data.channelId);
  }

  content() {
    const data = this.data();
    const user = this.attrs.notification.fromUser() as User | false;

    if (data.isDirect && !data.name) return ct('notifications.direct_message_from', { username: user ? user.displayName() : '' });

    return ct('notifications.message_in', {
      username: user ? user.displayName() : '',
      channel: data.name ? (data.isDirect ? data.name : `#${data.name}`) : '',
    });
  }

  excerpt() {
    return null;
  }
}
