/*
 * A página /notifications com a lista do menu do usuário (o
 * `.user-notifications-list` usa o mesmo CSS do `.quick-access-panel`) e as
 * abas de notificações do menu como abas
 * horizontais (`?filter=replies`, `likes`, `chat`, `other`). A mesma vista
 * serve à aba "Notificações" do perfil (`/u/:username/notifications`).
 */
import app from 'flarum/forum/app';
import Button from 'flarum/common/components/Button';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import UserMenu, { type UserMenuTab } from './UserMenu';
import { NotificationItem, dismissNotifications, filteredNotifications, type NotificationFilter } from './notifications';
import { EmptyState, NotificationSkeleton, preferencesLink, um, umText, neverLoaded } from './panels';
import { menuIcon } from './icons';

/** As abas do menu que são só notificações filtradas, com o nome usado na URL. */
function pageTabs(): { key: string; tab: UserMenuTab }[] {
  const menu: any = Object.create(UserMenu.prototype);
  menu.attrs = {};

  const keys: Record<string, string> = {
    'all-notifications': '',
    'chat-notifications': 'chat',
    'other-notifications': 'other',
  };

  return (menu.resolvedTopTabs() as UserMenuTab[]).filter((tab) => !!tab.filter).map((tab) => ({ key: tab.id in keys ? keys[tab.id] : tab.id, tab }));
}

/** Quantas páginas a mais buscar para encher uma aba filtrada (como no menu). */
const MAX_EXTRA_PAGES = 3;
const MIN_ITEMS = 10;
let extraPages = 0;

/**
 * Numa aba filtrada com poucos itens, busca as próximas páginas, como o
 * painel do menu: sem isso a aba do menu (que busca) mostrava notificações que
 * a página e a aba "Todas" ainda não tinham carregado.
 */
function fill(filter: NotificationFilter, count: number): void {
  const state: any = app.notifications;
  const filtered = !!(filter.types || filter.exclude);

  if (!filtered || count >= MIN_ITEMS || extraPages >= MAX_EXTRA_PAGES) return;
  if (state.isLoading() || state.isLoadingNext?.() || !state.hasItems() || !state.hasNext()) return;

  extraPages++;
  setTimeout(() => Promise.resolve(state.loadNext()).catch(() => {}), 0);
}

/** O endereço de cada aba: /notifications ou, no perfil, /u/:username/notifications. */
export type NotificationsHref = (filter: string) => string;

const defaultHref: NotificationsHref = (filter) => app.route('notifications', filter ? { filter } : {});

export default function NotificationsPageView(href: NotificationsHref = defaultHref): Mithril.Children {
  const state: any = app.notifications;
  const tabs = pageTabs();
  const current = String(m.route.param('filter') || '');
  const active = tabs.find((entry) => entry.key === current) || tabs[0];
  const filter = active?.tab.filter || {};
  const notifications = filteredNotifications(filter);

  fill(filter, notifications.length);
  const anyUnread = (app.session.user?.unreadNotificationCount() ?? 0) > 0;

  let list: Mithril.Children;

  if (notifications.length) {
    list = <ul className="CanelaUserMenu-list">{notifications.map((notification) => NotificationItem(notification))}</ul>;
  } else if (state.isLoading() || neverLoaded(state)) {
    list = NotificationSkeleton(8);
  } else if (!active || active.key === '') {
    list = EmptyState(um('empty.page_title'), [
      um('empty.page_body_1', { b: <b /> }),
      um('empty.notifications_body_2', { icon: menuIcon('bell'), a: preferencesLink() }),
    ]);
  } else {
    list = EmptyState(um('empty.generic'));
  }

  return (
    <div className="CanelaNotificationsPage-body">
      <div className="CanelaNotificationsPage-controls">
        <ul className="CanelaNotificationsPage-tabs" role="tablist">
          {tabs.map((entry) => (
            <li className={classList('CanelaNotificationsPage-tab', { active: entry === active })}>
              <Link href={href(entry.key)} role="tab" aria-selected={entry === active ? 'true' : 'false'}>
                {entry.tab.pageLabel || entry.tab.title}
              </Link>
            </li>
          ))}
        </ul>
        {anyUnread ? (
          <button
            type="button"
            className="Button CanelaUserMenu-dismiss"
            title={umText('dismiss_notifications_tooltip')}
            onclick={() => dismissNotifications(filter)}
          >
            {menuIcon('check')}
            <span className="CanelaUserMenu-dismissLabel">{um('dismiss')}</span>
          </button>
        ) : null}
      </div>
      <div className="CanelaNotificationsList user-notifications-list show-avatars">{list}</div>
      {state.hasNext() ? (
        <div className="CanelaNotificationsPage-more">
          <Button className="Button" loading={state.isLoadingNext()} onclick={() => state.loadNext()}>
            {app.translator.trans('core.forum.discussion_list.load_more_button')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
