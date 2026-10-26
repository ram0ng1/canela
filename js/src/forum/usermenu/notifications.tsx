/*
 * Notificações no formato do menu do usuário.
 *
 * O Flarum não agrupa as notificações por tipo no servidor (não há filtro
 * `type` na API), então as abas filtram no cliente, pelo `contentType()`, o
 * que o `app.notifications` já carregou. Os textos vêm dos componentes que
 * cada extensão registra (`app.notificationComponents`): o tema só muda a
 * forma — avatar de quem gerou com o ícone do tipo num selo, nome em negrito
 * e o título do tópico.
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import extractText from 'flarum/common/utils/extractText';
import type Notification from 'flarum/common/models/Notification';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { userMenu } from './state';

/** As abas que filtram notificações: "Respostas" junta mencionado, citado, respondido e postado. */
export const REPLY_TYPES = ['newPost', 'postMentioned', 'userMentioned', 'groupMentioned'];
/** `postReacted` é o tipo das reações (fof/reactions), que também vão para Curtidas. */
export const LIKE_TYPES = ['postLiked', 'postReacted'];
export const MESSAGE_TYPES = ['messageReceived'];
export const BOOKMARK_TYPES = ['canelaBookmarkReminder'];
export const CHAT_TYPES = ['canelaChatMention', 'canelaChatMessage'];
/** As do ramon/chat (thirdparty/ramonChat), quando ele toma o lugar do chat do tema: menções, convites, moderação e posse do canal. */
export const RAMON_CHAT_TYPES = [
  // Os do tema por cima do ramon/chat (thirdparty/ramonChat/features/notifications.tsx).
  'canelaRamonChatMention',
  'canelaRamonChatMessage',
  'chatMention',
  'chatMessage',
  'chatChannelInvite',
  'chatChannelInviteDeclined',
  'chatMessageFlagged',
  'chatModeratorPromoted',
  'chatOwnershipTransfer',
  'chatOwnershipTransferDeclined',
  'chatOwnershipInherited',
];

export interface NotificationFilter {
  /** Só estes tipos; sem a lista, todos. */
  types?: string[] | null;
  /** Todos menos estes (a aba "Outras notificações"). */
  exclude?: string[] | null;
}

/** Tudo o que o `app.notifications` já carregou, na ordem da API (mais novas primeiro). */
export function loadedNotifications(): Notification[] {
  const state: any = app.notifications;

  if (!state || typeof state.getPages !== 'function') return [];

  const list: Notification[] = [];

  state.getPages().forEach((page: any) => {
    (page.items || []).forEach((notification: Notification) => list.push(notification));
  });

  return list;
}

export function matches(notification: Notification, filter: NotificationFilter): boolean {
  const type = notification.contentType() || '';

  if (filter.types && !filter.types.includes(type)) return false;
  if (filter.exclude && filter.exclude.includes(type)) return false;

  // Sem componente registrado (extensão desligada) não há como desenhar.
  return !!app.notificationComponents?.[type];
}

export function filteredNotifications(filter: NotificationFilter): Notification[] {
  return loadedNotifications().filter((notification) => matches(notification, filter));
}

/** O número da bolha de uma aba: as não lidas daquele grupo entre as carregadas. */
export function unreadCount(filter: NotificationFilter): number {
  return filteredNotifications(filter).filter((notification) => !notification.isRead()).length;
}

/** Como o `Notification.markAsRead()` do core, para itens que não são o componente dele. */
export function markNotificationRead(notification: Notification): Promise<unknown> {
  if (notification.isRead()) return Promise.resolve();

  const user = app.session.user;

  user?.pushAttributes({ unreadNotificationCount: Math.max(0, (user.unreadNotificationCount() ?? 0) - 1) });

  return notification.save({ isRead: true }).catch(() => {});
}

/**
 * "Descartar": sem filtro, o POST /notifications/read do core (todas). Com
 * filtro, só as não lidas daquele grupo, uma a uma — o Flarum não descarta
 * por tipo.
 */
export function dismissNotifications(filter: NotificationFilter | null): Promise<unknown> {
  if (!filter || (!filter.types && !filter.exclude)) {
    return Promise.resolve(app.notifications.markAllAsRead()).then(() => m.redraw());
  }

  const unread = filteredNotifications(filter).filter((notification) => !notification.isRead());

  return Promise.all(unread.map((notification) => markNotificationRead(notification))).then(() => m.redraw());
}

function relatedDiscussion(notification: Notification): any {
  const subject: any = notification.subject();

  if (!subject) return null;
  if (subject.data?.type === 'discussions') return subject;
  if (typeof subject.discussion === 'function') return subject.discussion() || null;

  return null;
}

export interface NotificationView {
  icon: string;
  href: string;
  label: Mithril.Children;
  description: Mithril.Children;
  title: string;
}

/**
 * O que uma notificação mostra: quem gerou (em negrito) e o título do
 * tópico, com o tipo só no ícone.
 * Sem tópico ou sem outra pessoa (um emblema ganho, uma suspensão), o texto
 * do próprio componente vira a descrição, sem rótulo — como "Ganhou
 * 'Primeira curtida'". A frase inteira fica no `title`.
 */
export function describeNotification(notification: Notification): NotificationView | null {
  const Component = app.notificationComponents?.[notification.contentType() || ''];

  if (!Component) return null;

  // Os métodos dos componentes só leem `this.attrs.notification`: dá para
  // usá-los sem montar o componente (e sem o HeaderListItem dele).
  const instance: any = new Component();
  instance.attrs = { notification };

  const call = <T,>(method: string, fallback: T): T => {
    try {
      const value = instance[method]?.();
      return value === undefined || value === null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  };

  const content = call<Mithril.Children>('content', '');
  const title = extractText(content as any);
  const fromUser = notification.fromUser() as User | false | undefined;
  const discussion = relatedDiscussion(notification);
  const other = fromUser && fromUser !== app.session.user;

  return {
    icon: call('icon', 'fas fa-bell'),
    href: call('href', ''),
    label: other && discussion ? fromUser.displayName() : null,
    description: other && discussion ? discussion.title() : content,
    title,
  };
}

/** Sem pessoa (notificação do sistema): o ícone do fórum no lugar do avatar. */
function systemAvatar(): Mithril.Children {
  const src = app.forum.attribute<string | null>('faviconUrl') || app.forum.attribute<string | null>('logoUrl');

  return src ? <img className="Avatar CanelaUserMenu-systemAvatar" src={src} alt="" loading="lazy" /> : <Avatar user={null} />;
}

/** O `.icon-avatar`: avatar de 2em com o ícone do tipo num selo redondo no canto. */
export function IconAvatar(user: User | null | false | undefined, icon: string, system = false): Mithril.Children {
  return (
    <span className={classList('CanelaUserMenu-iconAvatar', system || !user ? 'system-avatar' : 'user-avatar')}>
      {user ? <Avatar user={user} /> : systemAvatar()}
      <span className="CanelaUserMenu-iconWrapper">
        <Icon name={icon} />
      </span>
    </span>
  );
}

export interface MenuItemAttrs {
  className?: string;
  unread?: boolean;
  href: string;
  title?: string;
  avatar: Mithril.Children;
  label?: Mithril.Children;
  description?: Mithril.Children;
  onclick?: (e: MouseEvent) => void;
}

/** O `<li>` do `menu-item`. Fecha o menu ao seguir o link. */
export function MenuItem(attrs: MenuItemAttrs): Mithril.Children {
  const external = attrs.href.includes('://');

  const content = [
    attrs.avatar,
    <div className="CanelaUserMenu-itemText">
      {attrs.label ? <span className="CanelaUserMenu-label">{attrs.label}</span> : null}
      {attrs.description ? <span className="CanelaUserMenu-description">{attrs.description}</span> : null}
    </div>,
  ];

  const onclick = (e: MouseEvent) => {
    attrs.onclick?.(e);

    // Abrir em outra aba não fecha nada.
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;

    userMenu.close();
  };

  return (
    <li className={classList('CanelaUserMenu-item', attrs.className, attrs.unread ? 'unread' : 'read')}>
      {attrs.href ? (
        <Link href={attrs.href} external={external} title={attrs.title} onclick={onclick}>
          {content}
        </Link>
      ) : (
        <button type="button" className="Button--ua-reset" title={attrs.title} onclick={onclick}>
          {content}
        </button>
      )}
    </li>
  );
}

export function NotificationItem(notification: Notification): Mithril.Children {
  const view = describeNotification(notification);

  if (!view) return null;

  return MenuItem({
    className: `CanelaUserMenu-item--notification Notification--${notification.contentType()}`,
    unread: !notification.isRead(),
    href: view.href,
    title: view.title,
    avatar: IconAvatar(notification.fromUser() as User | false, view.icon),
    label: view.label,
    description: view.description,
    onclick: () => markNotificationRead(notification),
  });
}
