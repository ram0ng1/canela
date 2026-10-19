/*
 * O menu do usuário do Discourse (`.user-menu.revamped.menu-panel`): a lista
 * da aba ativa à esquerda (`.quick-access-panel`, 320px) e a coluna de abas
 * de ícones à direita (`.menu-tabs-container`), com as abas de cima
 * (notificações por tipo) e as de baixo (perfil) separadas por uma linha.
 *
 * Ponto de extensão: `UserMenu.prototype.tabItems()` (abas de cima) e
 * `bottomTabItems()` (de baixo) são ItemLists de `UserMenuTab`. Outra área
 * do tema (o chat) ou outra extensão acrescenta a sua aba com `extend`:
 *
 *   extend(UserMenu.prototype, 'tabItems', function (items) {
 *     items.add('chat', { id: 'chat', icon: menuIcon('chat'), … }, 50);
 *   });
 *
 * Os tipos de notificação que uma aba declara em `types` saem da aba
 * "Outras notificações", como no Discourse.
 */
import app from 'flarum/forum/app';
import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import Separator from 'flarum/common/components/Separator';
import SessionDropdown from 'flarum/forum/components/SessionDropdown';
import ThemeSwitcher from 'flarum/forum/components/ThemeSwitcher';
import ItemList from 'flarum/common/utils/ItemList';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { menuIcon } from './icons';
import { DEFAULT_TAB, userMenu } from './state';
import {
  CHAT_TYPES,
  RAMON_CHAT_TYPES,
  LIKE_TYPES,
  MESSAGE_TYPES,
  BOOKMARK_TYPES,
  REPLY_TYPES,
  unreadCount,
  type NotificationFilter,
} from './notifications';
import { BookmarksPanel, MessagesPanel, NotificationsPanel, ProfilePanel, ReviewPanel, emptyStates, isMessagesEnabled, um, umText } from './panels';
import { forumBool } from '../utils/settings';
import { thirdParty } from '../thirdparty/settings';
import { canUseChat as canUseRamonChat } from '../thirdparty/ramonChat/bridge';
import { profileField, userStatus } from '../features/profile/data';
import { DEFAULT_STATUS_EMOJI, statusUntilLabel } from '../features/profile/components';
import { chatReviewCount, chatReviewOn } from '../thirdparty/ramonChat/features/flags';

export interface UserMenuTab {
  /** Único entre as abas; vira `#quick-access-{id}` e `#user-menu-button-{id}`. */
  id: string;
  /** O ícone da aba (um `menuIcon(...)` ou qualquer vnode). */
  icon: Mithril.Children;
  /** Rótulo para `title`/`aria-label` (sem o número). */
  title: string;
  /** Rótulo com o número de não lidas, quando houver. */
  titleWithUnread?: (count: number) => string;
  /** O número da bolha da aba; zero esconde. */
  count?: () => number;
  /** Clicar na aba já ativa leva a esta página (o `linkWhenActive`). */
  href?: () => string | null;
  /** Os tipos de notificação da aba (saem de "Outras notificações"). */
  types?: string[];
  /** Aba de notificações filtradas: também vira aba na página /notifications. */
  filter?: NotificationFilter;
  /** Rótulo curto da aba na página /notifications. */
  pageLabel?: string;
  /** O conteúdo da aba. */
  panel: () => Mithril.Children;
}

export interface UserMenuAttrs extends ComponentAttrs {}

function notificationsHref(filter?: string): string {
  return app.route('notifications', filter ? { filter } : {});
}

export default class UserMenu extends Component<UserMenuAttrs> {
  view() {
    const top = this.resolvedTopTabs();
    const bottom = this.bottomTabItems().toArray();
    const all = [...top, ...bottom];
    const current = all.find((tab) => tab.id === userMenu.tab) || all[0];

    if (current && current.id !== userMenu.tab) userMenu.tab = current.id;

    return (
      <div
        className={classList('CanelaUserMenu', 'user-menu', 'show-avatars')}
        id="canela-user-menu"
        data-tab-id={current?.id}
        onkeydown={this.onkeydown.bind(this)}
      >
        <div className="CanelaUserMenu-bodyContents">
          <div className="CanelaUserMenu-tabs" role="tablist" aria-orientation="vertical" aria-label={umText('sr_menu_tabs')}>
            <div className="CanelaUserMenu-tabList CanelaUserMenu-tabList--top">{top.map((tab, index) => this.tabButton(tab, index))}</div>
            <div className="CanelaUserMenu-tabList CanelaUserMenu-tabList--bottom">
              {bottom.map((tab, index) => this.tabButton(tab, top.length + index))}
            </div>
          </div>
          <div
            className="CanelaUserMenu-panel"
            id={`quick-access-${current?.id}`}
            role="tabpanel"
            aria-labelledby={`user-menu-button-${current?.id}`}
          >
            {/* A chave recria o conteúdo ao trocar de aba (cada uma carrega o seu). */}
            {current
              ? [
                  <div key={current.id} className="CanelaUserMenu-panelInner">
                    {current.panel()}
                  </div>,
                ]
              : null}
          </div>
        </div>
      </div>
    );
  }

  oncreate(vnode: Mithril.VnodeDOM<UserMenuAttrs, this>) {
    super.oncreate(vnode);

    // Como o `focusFirstTab` do Discourse: o foco vai para a aba ativa.
    (this.element.querySelector('.CanelaUserMenu-tab.active') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  /**
   * As abas de cima, na ordem do Discourse: todas, respostas, curtidas,
   * mensagens, marcadores, (abas de extensões), revisão e "outras".
   */
  tabItems(): ItemList<UserMenuTab> {
    const items = new ItemList<UserMenuTab>();
    const user = app.session.user;

    items.add(
      'all-notifications',
      {
        id: DEFAULT_TAB,
        icon: menuIcon('bell'),
        title: umText('tabs.all_notifications'),
        href: () => notificationsHref(),
        filter: {},
        pageLabel: umText('page.all'),
        panel: () => (
          <NotificationsPanel
            filter={{}}
            empty={emptyStates.notifications}
            showAllHref={notificationsHref()}
            showAllTitle={umText('view_all_notifications')}
          />
        ),
      },
      100
    );

    items.add(
      'replies',
      {
        id: 'replies',
        icon: menuIcon('reply'),
        title: umText('tabs.replies'),
        titleWithUnread: (count) => umText('tabs.replies_with_unread', { count }),
        count: () => unreadCount({ types: REPLY_TYPES }),
        href: () => notificationsHref('replies'),
        types: REPLY_TYPES,
        filter: { types: REPLY_TYPES },
        pageLabel: umText('page.replies'),
        panel: () => (
          <NotificationsPanel
            filter={{ types: REPLY_TYPES }}
            empty={emptyStates.notifications}
            showAllHref={notificationsHref('replies')}
            showAllTitle={umText('view_all_notifications')}
          />
        ),
      },
      90
    );

    if ('flarum-likes' in flarum.extensions) {
      items.add(
        'likes',
        {
          id: 'likes',
          icon: menuIcon('heart'),
          title: umText('tabs.likes'),
          titleWithUnread: (count) => umText('tabs.likes_with_unread', { count }),
          count: () => unreadCount({ types: LIKE_TYPES }),
          href: () => notificationsHref('likes'),
          types: LIKE_TYPES,
          filter: { types: LIKE_TYPES },
          pageLabel: umText('page.likes'),
          panel: () => (
            <NotificationsPanel
              filter={{ types: LIKE_TYPES }}
              empty={emptyStates.likes}
              showAllHref={notificationsHref('likes')}
              showAllTitle={umText('view_all_notifications')}
            />
          ),
        },
        80
      );
    }

    if (isMessagesEnabled()) {
      items.add(
        'messages',
        {
          id: 'messages',
          icon: menuIcon('mail'),
          title: umText('tabs.messages'),
          titleWithUnread: (count) => umText('tabs.messages_with_unread', { count }),
          count: () => user?.attribute<number>('unreadDialogCount') || 0,
          href: () => app.route('messages'),
          types: MESSAGE_TYPES,
          panel: () => <MessagesPanel />,
        },
        70
      );
    }

    if (user && forumBool('canelaBookmarksEnabled', false) && app.routes['canela.user.bookmarks']) {
      items.add(
        'bookmarks',
        {
          id: 'bookmarks',
          icon: menuIcon('bookmark'),
          title: umText('tabs.bookmarks'),
          titleWithUnread: (count) => umText('tabs.bookmarks_with_unread', { count }),
          count: () => unreadCount({ types: BOOKMARK_TYPES }),
          href: () => app.route('canela.user.bookmarks', { username: user.slug() }),
          types: BOOKMARK_TYPES,
          panel: () => <BookmarksPanel />,
        },
        60
      );
    }

    // O chat do tema (recurso `chat`): as notificações dele, como a aba
    // `chat-notifications` do plugin do Discourse. O recurso pode trocar esta
    // aba pela sua, com o mesmo nome. Com o ramon/chat no lugar do chat do
    // tema, a aba mostra as notificações dele.
    const chatTypes = forumBool('canelaChatEnabled', false)
      ? CHAT_TYPES
      : thirdParty.ramonChatNotifications() && canUseRamonChat()
        ? RAMON_CHAT_TYPES
        : null;

    if (chatTypes) {
      items.add(
        'chat',
        {
          id: 'chat-notifications',
          icon: menuIcon('chat'),
          title: umText('tabs.chat_notifications'),
          titleWithUnread: (count) => umText('tabs.chat_notifications_with_unread', { count }),
          count: () => unreadCount({ types: chatTypes }),
          href: () => notificationsHref('chat'),
          types: chatTypes,
          filter: { types: chatTypes },
          pageLabel: umText('page.chat'),
          panel: () => (
            <NotificationsPanel
              filter={{ types: chatTypes }}
              empty={emptyStates.chat}
              showAllHref={notificationsHref('chat')}
              showAllTitle={umText('view_all_notifications')}
            />
          ),
        },
        50
      );
    }

    // A fila de revisão: os posts sinalizados (flarum/flags), para quem os vê.
    // Mais as denúncias do chat (ramon/chat), somadas na mesma aba.
    if ((app.forum.attribute('canViewFlags') && (app as any).flags) || chatReviewOn()) {
      items.add(
        'review-queue',
        {
          id: 'review-queue',
          icon: menuIcon('flag'),
          title: umText('tabs.review_queue'),
          titleWithUnread: (count) => umText('tabs.review_queue_with_unread', { count }),
          count: () => (Number(app.forum.attribute<number>('flagCount')) || 0) + chatReviewCount(),
          href: () => (app.routes['flags'] ? app.route('flags') : null),
          panel: () => <ReviewPanel />,
        },
        20
      );
    }

    return items;
  }

  /** As abas de cima mais a "Outras notificações", com os tipos que sobraram. */
  resolvedTopTabs(): UserMenuTab[] {
    const items = this.tabItems();

    if (!items.has('other-notifications')) {
      const used = items
        .toArray()
        .flatMap((tab) => tab.types || tab.filter?.types || [])
        .filter(Boolean);

      items.add('other-notifications', this.otherTab(used), 10);
    }

    return items.toArray();
  }

  otherTab(used: string[]): UserMenuTab {
    const filter: NotificationFilter = { exclude: used };

    return {
      id: 'other-notifications',
      icon: menuIcon('other'),
      title: umText('tabs.other_notifications'),
      titleWithUnread: (count) => umText('tabs.other_notifications_with_unread', { count }),
      count: () => unreadCount(filter),
      href: () => notificationsHref('other'),
      filter,
      pageLabel: umText('page.other'),
      panel: () => (
        <NotificationsPanel
          filter={filter}
          empty={emptyStates.other}
          showAllHref={notificationsHref('other')}
          showAllTitle={umText('view_all_notifications')}
        />
      ),
    };
  }

  bottomTabItems(): ItemList<UserMenuTab> {
    const items = new ItemList<UserMenuTab>();
    const user = app.session.user;

    if (!user) return items;

    items.add(
      'profile',
      {
        id: 'profile',
        icon: menuIcon('user'),
        title: umText('tabs.profile'),
        href: () => app.route.user(user),
        panel: () => ProfilePanel(this.profileItems()),
      },
      100
    );

    return items;
  }

  /**
   * Os itens da aba Perfil: tudo o que o menu da sessão oferece (core, tema
   * e extensões), mais o que o Discourse tem ali e o Flarum não: status,
   * Resumo, Atividade, Mensagens e o modo claro/escuro.
   */
  profileItems(): ItemList<Mithril.Children> {
    const user = app.session.user!;
    const session: any = Object.create(SessionDropdown.prototype);
    session.attrs = {};

    const items: ItemList<Mithril.Children> = SessionDropdown.prototype.items.call(session);

    // A identidade (avatar e nome) do menu da sessão não existe na aba do
    // Discourse: o avatar já está no cabeçalho.
    ['canelaIdentity', 'canelaIdentitySeparator'].forEach((key) => items.has(key) && items.remove(key));

    if (profileField('status') && !items.has('canelaStatus')) {
      const status = userStatus(user);

      items.add(
        'canelaStatus',
        <LinkButton className="CanelaUserMenu-status" href={app.route('settings')} icon={status ? undefined : 'fas fa-circle-plus'}>
          {status
            ? [
                <span className="CanelaUserMenu-statusEmoji" aria-hidden="true">
                  {status.emoji || DEFAULT_STATUS_EMOJI}
                </span>,
                <span className="CanelaUserMenu-statusText">{status.text}</span>,
                status.until ? <span className="CanelaUserMenu-statusUntil">{statusUntilLabel(status.until)}</span> : null,
              ]
            : um('profile.set_custom_status')}
        </LinkButton>,
        200
      );

      items.add('canelaStatusSeparator', <Separator />, 150);
    }

    // Sem "Resumo": o "Perfil" já abre o resumo (aba padrão do perfil).

    if (!items.has('canelaActivity')) {
      const route = app.routes['user.activity'] ? 'user.activity' : 'user.posts';

      items.add(
        'canelaActivity',
        <LinkButton icon="fas fa-bars-staggered" href={app.route(route, { username: user.slug() })}>
          {um('profile.activity')}
        </LinkButton>,
        94
      );
    }

    if (isMessagesEnabled() && !items.has('messages')) {
      items.add(
        'messages',
        <LinkButton icon="far fa-envelope" href={app.route('messages')}>
          {um('profile.messages')}
        </LinkButton>,
        80
      );
    }

    if (app.allowUserColorScheme) {
      const switcher: any = Object.create(ThemeSwitcher.prototype);
      switcher.attrs = {};

      const active: string = ThemeSwitcher.prototype.active.call(switcher);
      const resolved = String(active === 'auto' ? app.getSystemColorSchemePreference() : active);
      const dark = resolved.startsWith('dark');

      items.add(
        'canelaColorScheme',
        <Button icon={dark ? 'far fa-sun' : 'far fa-moon'} onclick={() => ThemeSwitcher.prototype.select.call(switcher, dark ? 'light' : 'dark')}>
          {um(dark ? 'profile.light_mode' : 'profile.dark_mode')}
        </Button>,
        -80
      );
    }

    return items;
  }

  tabButton(tab: UserMenuTab, position: number): Mithril.Children {
    const active = tab.id === userMenu.tab;
    const count = tab.count ? tab.count() : 0;
    const title = count && tab.titleWithUnread ? tab.titleWithUnread(count) : tab.title;
    const href = tab.href ? tab.href() : null;

    return (
      <a
        className={classList('CanelaUserMenu-tab', `CanelaUserMenu-tab--${tab.id}`, { active })}
        id={`user-menu-button-${tab.id}`}
        role="tab"
        href={href || undefined}
        aria-controls={`quick-access-${tab.id}`}
        aria-selected={active ? 'true' : 'false'}
        aria-label={title}
        title={title}
        tabindex={active ? 0 : -1}
        data-tab-number={position}
        onclick={(e: MouseEvent) => this.selectTab(tab, e)}
      >
        <span className="CanelaUserMenu-tabIcon">{tab.icon}</span>
        {count ? (
          <span className="CanelaUserMenu-badge" aria-hidden="true">
            {count}
          </span>
        ) : null}
      </a>
    );
  }

  /**
   * Como o `handleTabClick` do Discourse: numa aba já ativa (ou abrindo em
   * nova aba) o link segue para a página completa; nas outras, só troca o
   * conteúdo.
   */
  selectTab(tab: UserMenuTab, e: MouseEvent | KeyboardEvent): void {
    const newWindow = e instanceof MouseEvent && (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1);
    const href = tab.href ? tab.href() : null;

    if (newWindow) return;

    e.preventDefault();

    if (userMenu.tab === tab.id) {
      if (href) {
        userMenu.close();
        m.route.set(href);
      }

      return;
    }

    userMenu.tab = tab.id;
  }

  /** Setas para cima e para baixo percorrem as abas (`role="tablist"` vertical). */
  onkeydown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement;

    if (!target.classList?.contains('CanelaUserMenu-tab')) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      target.click();
      return;
    }

    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;

    const tabs = Array.from(this.element.querySelectorAll<HTMLElement>('.CanelaUserMenu-tab'));
    const index = tabs.indexOf(target);
    let next = index;

    if (e.key === 'ArrowDown') next = (index + 1) % tabs.length;
    if (e.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;

    e.preventDefault();
    tabs[next]?.focus();
  }
}
