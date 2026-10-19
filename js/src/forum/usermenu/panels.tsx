/*
 * O conteúdo de cada aba do menu do usuário (o `.quick-access-panel` do
 * Discourse): a lista (`items-list`), o rodapé com "ver todas" (⌄) e
 * "Descartar", e o estado vazio com os textos do Discourse.
 *
 * As listas usam os estados que o core e as extensões já mantêm
 * (`app.notifications`, `app.dialogs` do flarum/messages, `app.flags` do
 * flarum/flags) — o que o menu carrega serve também às páginas deles.
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import listItems from 'flarum/common/helpers/listItems';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Notification from 'flarum/common/models/Notification';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import {
  BOOKMARK_TYPES,
  IconAvatar,
  MenuItem,
  NotificationItem,
  dismissNotifications,
  filteredNotifications,
  type NotificationFilter,
} from './notifications';
import { menuIcon } from './icons';
import { userMenu } from './state';
import { isExtensionEnabled } from '../utils/settings';
import { umText } from './text';
import { messageStaff } from '../features/messages/util';
import { chatReviewOn } from '../thirdparty/ramonChat/features/flags';
import { messagePath } from '../thirdparty/ramonChat/features/permalink';
import { loadChatReports, type ChatReport } from '../thirdparty/ramonChat/features/reviewData';

/** Tradução rica (com `<a>`, `<b>` e ícones): o `t()` do tema devolve só texto. */
export function um(key: string, params: Record<string, unknown> = {}): Mithril.Children {
  return app.translator.trans(`ramon-canela.forum.usermenu.${key}`, params) as any;
}

/** A mesma, como texto (title, aria-label); mora em text.ts, que o pacote principal usa. */
export { umText };

/**
 * A lista ainda não recebeu nenhuma resposta (nem vazia)? O PaginatedListState
 * guarda uma página por resposta, mesmo sem itens: sem página, "nenhum item"
 * ainda não significa nada e o aviso de lista vazia piscaria antes dos itens.
 */
export function neverLoaded(state: any): boolean {
  return !!state && typeof state.getPages === 'function' && state.getPages().length === 0;
}

/** As "preferências de notificação" do Flarum ficam nas Configurações. */
export function preferencesLink(): Mithril.Vnode<any, any> {
  return <Link href={app.route('settings')} onclick={() => userMenu.close()} />;
}

// ---------------------------------------------------------------------
// Estado vazio (`DEmptyState`): título e um parágrafo, com o `<br><br>` do
// Discourse entre as duas frases.
// ---------------------------------------------------------------------

export function EmptyState(title: Mithril.Children, body?: Mithril.Children[]): Mithril.Children {
  const parts = (body || []).filter((part) => part !== null && part !== undefined && part !== '');
  const paragraph: Mithril.Children[] = [];

  parts.forEach((part, index) => {
    if (index > 0) paragraph.push(<br />, <br />);
    paragraph.push(part);
  });

  return (
    <div className={classList('CanelaUserMenu-emptyContainer', '--text-only')}>
      <div className="CanelaUserMenu-empty">
        <div className="CanelaUserMenu-emptyTitle">{title}</div>
        {paragraph.length ? (
          <div className="CanelaUserMenu-emptyBody">
            <p>{paragraph}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const bold = () => <b />;

export const emptyStates = {
  notifications: () =>
    EmptyState(um('empty.notifications_title'), [
      um('empty.notifications_body_1', { b: bold() }),
      um('empty.notifications_body_2', { icon: menuIcon('bell'), a: preferencesLink() }),
    ]),
  likes: () => EmptyState(um('empty.likes_title'), [um('empty.likes_body_1'), um('empty.likes_body_2', { a: preferencesLink() })]),
  messages: () => {
    const about = app.routes['canela.about'] ? app.route('canela.about') : app.route('index');

    return EmptyState(um('empty.messages_title'), [
      um('empty.messages_body_1', { icon: menuIcon('mail') }),
      um('empty.messages_body_2', {
        a: (
          <Link
            href={about}
            onclick={(event: MouseEvent) => {
              userMenu.close();
              messageStaff(event);
            }}
          />
        ),
      }),
    ]);
  },
  bookmarks: () => EmptyState(um('empty.bookmarks_title'), [um('empty.bookmarks_body', { icon: menuIcon('bookmark') })]),
  other: () => EmptyState(um('empty.other_title'), [um('empty.other_body')]),
  chat: () => EmptyState(um('empty.chat_title'), [um('empty.chat_body_1', { b: bold() }), um('empty.chat_body_2', { a: preferencesLink() })]),
  generic: () => EmptyState(um('empty.generic')),
};

export function Spinner(): Mithril.Children {
  return (
    <div className="CanelaUserMenu-spinnerContainer">
      <div className="CanelaUserMenu-spinner" />
    </div>
  );
}

/**
 * A lista de notificações ainda sem resposta: linhas com a altura de um item
 * (avatar e duas linhas de texto, cada barra com a altura de uma linha do
 * texto real), em vez do spinner: o painel já abre no tamanho de uma lista e
 * não salta quando ela chega.
 */
export function NotificationSkeleton(rows = 8): Mithril.Children {
  return (
    <ul className="CanelaUserMenu-list CanelaUserMenu-list--loading" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <li className="CanelaUserMenu-item CanelaUserMenu-item--skeleton">
          <div className="CanelaUserMenu-skeletonRow">
            <span className="CanelaSkeleton CanelaUserMenu-skeletonAvatar" />
            <span className="CanelaUserMenu-itemText">
              <span className="CanelaSkeleton CanelaSkeleton--line" style={{ width: `${45 + ((index * 17) % 30)}%` }} />
              <span className="CanelaSkeleton CanelaSkeleton--line" style={{ width: `${70 + ((index * 11) % 25)}%` }} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * O `.panel-body-bottom`: o botão largo com a setinha leva à página completa
 * da aba; "Descartar" marca como lidas.
 */
export function PanelBottom(attrs: { showAllHref?: string | null; showAllTitle?: string; dismiss?: (() => unknown) | null; dismissTitle?: string }) {
  return (
    <div className="CanelaUserMenu-bottom">
      {attrs.showAllHref ? (
        <Link
          className="Button CanelaUserMenu-showAll"
          href={attrs.showAllHref}
          title={attrs.showAllTitle}
          aria-label={attrs.showAllTitle}
          onclick={() => userMenu.close()}
        >
          {/* Só o chevron (o `show-all` do Discourse) não dizia o que fazia. */}
          <span className="CanelaUserMenu-showAllLabel">{um('view_all')}</span>
        </Link>
      ) : null}
      {attrs.dismiss ? (
        <button type="button" className="Button CanelaUserMenu-dismiss" title={attrs.dismissTitle} onclick={() => attrs.dismiss!()}>
          {menuIcon('check')}
          <span className="CanelaUserMenu-dismissLabel">{um('dismiss')}</span>
        </button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------
// Notificações (todas, respostas, curtidas, chat, outras)
// ---------------------------------------------------------------------

export interface NotificationsPanelAttrs extends ComponentAttrs {
  filter: NotificationFilter;
  empty: () => Mithril.Children;
  showAllHref?: string | null;
  showAllTitle?: string;
  dismissTitle?: string;
  /** Itens extras antes das notificações (os marcadores usam). */
  extra?: () => Mithril.Children[];
}

/** Quantas páginas a mais buscar para encher uma aba filtrada (a API não filtra por tipo). */
const MAX_EXTRA_PAGES = 3;
const MIN_ITEMS = 10;

export class NotificationsPanel extends Component<NotificationsPanelAttrs> {
  extraPages = 0;

  view() {
    const state: any = app.notifications;
    const notifications = filteredNotifications(this.attrs.filter);
    const extra = this.attrs.extra ? this.attrs.extra() : [];
    const items = [...extra, ...notifications.map((notification: Notification) => NotificationItem(notification))].filter(Boolean);
    const loading = (state.isLoading() || neverLoaded(state)) && !items.length;

    if (loading) return NotificationSkeleton();

    if (!items.length) {
      // Ainda pode haver do tipo nas próximas páginas.
      if (this.wantsMore()) return Spinner();

      return this.attrs.empty();
    }

    const anyUnread = (app.session.user?.unreadNotificationCount() ?? 0) > 0;

    return [
      <ul className="CanelaUserMenu-list">{items}</ul>,
      PanelBottom({
        showAllHref: this.attrs.showAllHref,
        showAllTitle: this.attrs.showAllTitle,
        // O Discourse mostra "Descartar" em qualquer aba de notificações quando
        // há alguma não lida, e descarta só os tipos daquela aba.
        dismiss: anyUnread ? () => dismissNotifications(this.attrs.filter) : null,
        dismissTitle: this.attrs.dismissTitle || umText('dismiss_notifications_tooltip'),
      }),
    ];
  }

  oncreate(vnode: Mithril.VnodeDOM<NotificationsPanelAttrs, this>) {
    super.oncreate(vnode);
    this.fill();
  }

  onupdate(vnode: Mithril.VnodeDOM<NotificationsPanelAttrs, this>) {
    super.onupdate(vnode);
    this.fill();
  }

  wantsMore(): boolean {
    const state: any = app.notifications;
    const filtered = !!(this.attrs.filter.types || this.attrs.filter.exclude);

    return filtered && state.hasNext() && this.extraPages < MAX_EXTRA_PAGES && filteredNotifications(this.attrs.filter).length < MIN_ITEMS;
  }

  /** Numa aba filtrada com poucos itens, busca as próximas páginas (até 3). */
  fill(): void {
    const state: any = app.notifications;

    if (state.isLoading() || !state.hasItems() || !this.wantsMore()) return;

    this.extraPages++;
    Promise.resolve(state.loadNext()).catch(() => {});
  }
}

// ---------------------------------------------------------------------
// Mensagens (flarum/messages): as conversas, a não lida em destaque.
// ---------------------------------------------------------------------

export class MessagesPanel extends Component {
  /**
   * Já houve uma resposta da lista? Antes dela, "nenhuma conversa" ainda não
   * quer dizer nada: o primeiro desenho acontecia antes do pedido começar e o
   * aviso de "Você não tem mensagens" piscava antes dos itens.
   */
  ready = false;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    const state: any = (app as any).dialogs;

    this.ready = !!state && typeof state.getPages === 'function' && state.getPages().length > 0;

    if (state && typeof state.load === 'function') {
      Promise.resolve(state.load())
        .catch(() => {})
        .finally(() => {
          this.ready = true;
          m.redraw();
        });
    } else {
      this.ready = true;
    }
  }

  view() {
    const state: any = (app as any).dialogs;

    if (!state) return emptyStates.messages();

    const dialogs: any[] = typeof state.getAllItems === 'function' ? state.getAllItems() : [];

    if (!dialogs.length) return !this.ready || state.isLoading() || neverLoaded(state) ? Spinner() : emptyStates.messages();

    const unread = (app.session.user?.attribute<number>('unreadDialogCount') ?? 0) > 0;

    return [
      <ul className="CanelaUserMenu-list">
        {dialogs.map((dialog) => {
          const recipient: User | null = dialog.recipient?.() || null;
          const lastMessage: any = dialog.lastMessage?.();
          const preview = (lastMessage?.contentPlain?.() || '').slice(0, 80);
          const name = recipient ? recipient.displayName() : '';

          return MenuItem({
            className: 'CanelaUserMenu-item--message',
            unread: !!dialog.unreadCount?.(),
            href: (app.route as any).dialog ? (app.route as any).dialog(dialog) : app.route('messages'),
            title: name,
            avatar: IconAvatar(recipient, 'far fa-envelope'),
            label: name,
            description: preview,
          });
        })}
      </ul>,
      PanelBottom({
        showAllHref: app.route('messages'),
        showAllTitle: umText('view_all_messages'),
        dismiss: unread && typeof state.markAllAsRead === 'function' ? () => state.markAllAsRead() : null,
        dismissTitle: umText('dismiss_messages_tooltip'),
      }),
    ];
  }
}

// ---------------------------------------------------------------------
// Marcadores (recurso `bookmarks` do tema): os lembretes não lidos primeiro,
// depois os marcadores mais recentes.
// ---------------------------------------------------------------------

export class BookmarksPanel extends Component {
  bookmarks: any[] = [];
  loading = true;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    const include = ['post', 'post.discussion', 'post.user'];

    app.store
      .find<any[]>('canela-bookmarks', { include: include.join(','), page: { limit: 20 } } as any)
      .then((results: any) => {
        this.bookmarks = Array.isArray(results) ? results.slice() : [];
      })
      .catch(() => {})
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  view() {
    const reminders = filteredNotifications({ types: BOOKMARK_TYPES }).filter((notification) => !notification.isRead());

    const items = [
      ...reminders.map((notification) => NotificationItem(notification)),
      ...this.bookmarks.map((bookmark) => {
        const post: Post | null = bookmark.post?.() || null;

        if (!post) return null;

        const user = post.user() as User | false;
        const discussion: any = post.discussion();

        return MenuItem({
          className: 'CanelaUserMenu-item--bookmark bookmark',
          href: app.route.post(post),
          title: bookmark.name?.() || discussion?.title?.() || '',
          avatar: IconAvatar(user, bookmark.hasPendingReminder?.() ? 'fas fa-clock' : 'far fa-bookmark'),
          label: user ? user.displayName() : null,
          description: discussion?.title?.() || '',
        });
      }),
    ].filter(Boolean);

    if (!items.length) return this.loading ? Spinner() : emptyStates.bookmarks();

    const user = app.session.user!;

    return [
      <ul className="CanelaUserMenu-list">{items}</ul>,
      PanelBottom({
        showAllHref: app.routes['canela.user.bookmarks'] ? app.route('canela.user.bookmarks', { username: user.slug() }) : null,
        showAllTitle: umText('view_all_bookmarks'),
        dismiss: reminders.length ? () => dismissNotifications({ types: BOOKMARK_TYPES }) : null,
        dismissTitle: umText('dismiss_bookmarks_tooltip'),
      }),
    ];
  }
}

// ---------------------------------------------------------------------
// Revisão (flarum/flags): os posts sinalizados, para a moderação.
// ---------------------------------------------------------------------

export class ReviewPanel extends Component {
  /** As denúncias do chat (ramon/chat), na mesma lista dos posts. */
  chatReports: ChatReport[] = [];
  chatLoading = false;

  oncreate(vnode: Mithril.VnodeDOM<any, this>) {
    super.oncreate(vnode);

    const state: any = (app as any).flags;

    if (app.forum.attribute('canViewFlags') && state && typeof state.load === 'function') {
      Promise.resolve(state.load())
        // A API marcou a fila como vista (`read_flags_at`): a bandeira do avatar sai.
        .then(() => app.session.user?.pushAttributes({ newFlagCount: 0 }))
        .catch(() => {});
    }

    if (chatReviewOn()) {
      this.chatLoading = true;

      loadChatReports()
        .then((reports) => (this.chatReports = reports))
        .catch(() => {})
        .then(() => {
          this.chatLoading = false;
          m.redraw();
        });
    }
  }

  view() {
    const state: any = (app as any).flags;
    const flags: any[] = app.forum.attribute('canViewFlags') && state && typeof state.getAllItems === 'function' ? state.getAllItems() : [];
    const rows: { date: number; item: Mithril.Children }[] = [];

    flags.forEach((flag) => {
      const post: Post | null = flag.post?.() || null;

      if (!post) return;

      const user = post.user() as User | false;
      const discussion: any = post.discussion();

      rows.push({
        date: flag.createdAt?.()?.getTime?.() || 0,
        item: MenuItem({
          className: 'CanelaUserMenu-item--reviewable reviewable pending',
          unread: true,
          href: app.route.post(post),
          title: post.contentPlain?.() || '',
          avatar: IconAvatar(user, 'fas fa-flag'),
          label: user ? user.displayName() : null,
          description: discussion?.title?.() || '',
        }),
      });
    });

    // As mensagens do chat denunciadas, pela data, junto com os posts.
    this.chatReports.forEach((report) => {
      const message = report.message;
      const user = (message.user?.() as User | false) || null;
      const channel = message.channel?.() || null;

      rows.push({
        date: report.date.getTime(),
        item: MenuItem({
          className: 'CanelaUserMenu-item--reviewable CanelaUserMenu-item--chatReport reviewable pending',
          unread: true,
          href: app.routes['flags']
            ? app.route('flags', { type: 'chat' })
            : messagePath(Number(message.channelId()), Number(message.id()), message.threadId?.()),
          title: message.content?.() || '',
          avatar: IconAvatar(user, 'far fa-message'),
          label: user ? user.displayName() : null,
          description: channel ? (channel.isDirect?.() ? channel.displayName() : `#${channel.displayName()}`) : '',
        }),
      });
    });

    if (!rows.length) {
      const loading = state?.isLoading?.() || (app.forum.attribute('canViewFlags') && neverLoaded(state)) || this.chatLoading;

      return loading ? Spinner() : emptyStates.generic();
    }

    return [
      <ul className="CanelaUserMenu-list">{rows.sort((a, b) => b.date - a.date).map((row) => row.item)}</ul>,
      PanelBottom({
        showAllHref: app.routes['flags'] ? app.route('flags') : null,
        showAllTitle: umText('view_all_reviewables'),
      }),
    ];
  }
}

// ---------------------------------------------------------------------
// Perfil: os itens do menu da sessão (os do core, os do tema e os de
// qualquer extensão que estenda `SessionDropdown.prototype.items`).
// ---------------------------------------------------------------------

export function ProfilePanel(items: ItemList<Mithril.Children>): Mithril.Children {
  return (
    <ul
      className="CanelaUserMenu-profile"
      onclick={(e: MouseEvent) => {
        // Seguir um item (ou sair, ou trocar o tema) fecha o menu, como o
        // `closeUserMenu` do Discourse.
        if ((e.target as HTMLElement).closest('a, button')) userMenu.close();
      }}
    >
      {listItems(items.toArray())}
    </ul>
  );
}

export function isMessagesEnabled(): boolean {
  return isExtensionEnabled('flarum-messages') && !!(app as any).dialogs;
}
