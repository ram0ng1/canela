/*
 * O conteúdo de cada "rota" do chat, com a barra de cima de cada uma.
 * A gaveta e a página cheia
 * desenham a mesma coisa; muda só a navegação (estado da gaveta × URL) e os
 * botões da barra.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Dropdown from 'flarum/common/components/Dropdown';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat from '../ChatStore';
import ChatChannel from './ChatChannel';
import ChannelsList, { ChatFooter, ensureChannel, go } from './ChannelsList';
import BrowseChannels from './BrowseChannels';
import MessageCreator from './MessageCreator';
import ChannelInfo from './ChannelInfo';
import { ChatSearch, PinsList, ThreadList } from './lists';
import { ChannelTitle, drawerButtons, Navbar, UnreadIndicator, type NavbarButton } from './bits';
import { caps, channelTitle, chatRequest, ct, pushUsers } from '../utils';
import type { ChatChannel as Channel, ChatRoute, ThreadLevel } from '../types';

export interface RouteViewAttrs extends ComponentAttrs {
  route: ChatRoute;
  inDrawer: boolean;
  /** Na página cheia do computador a lista mora na barra lateral: sem "voltar". */
  sideList?: boolean;
}

const LIST_ROUTES = ['channels', 'direct-messages', 'threads', 'search'];

export default class RouteView extends Component<RouteViewAttrs> {
  private loadingChannel: number | null = null;
  private missing = new Set<number>();

  view(): Mithril.Children {
    const { route, inDrawer } = this.attrs;
    const expanded = !inDrawer || chat.drawer.expanded;
    const toggle = inDrawer ? () => chat.toggleExpand() : undefined;

    if (LIST_ROUTES.includes(route.name)) {
      const title = inDrawer ? ct('heading') : this.listTitle(route.name);

      return (
        <div className={`c-drawer-routes c-routes --${route.name}`}>
          {Navbar({ title, actions: [...this.pageButtons(), ...drawerButtons(inDrawer)], onclick: toggle })}
          {expanded && [
            <div className="chat-drawer-content" key="content">
              {this.listBody(route)}
            </div>,
            <ChatFooter key="footer" current={route.name} inDrawer={inDrawer} />,
          ]}
        </div>
      );
    }

    if (route.name === 'browse' || route.name === 'new-message') {
      return (
        <div className={`c-drawer-routes c-routes --${route.name}`}>
          {Navbar({
            title: route.name === 'browse' ? ct('browse.title') : ct('direct_message_creator.title'),
            back: () => go({ name: route.name === 'browse' ? 'channels' : 'direct-messages' }, inDrawer),
            actions: drawerButtons(inDrawer),
            onclick: toggle,
          })}
          {expanded && (
            <div className="chat-drawer-content">
              {route.name === 'browse' ? <BrowseChannels filter={route.filter} inDrawer={inDrawer} /> : <MessageCreator inDrawer={inDrawer} />}
            </div>
          )}
        </div>
      );
    }

    // Daqui em diante, toda rota é de um canal.
    const channelRoute = route as Extract<ChatRoute, { channelId: number }>;
    const channel = chat.channels.get(channelRoute.channelId);

    if (!channel) return this.loadChannel(channelRoute.channelId);

    if (!inDrawer) chat.activeChannelId = channel.id;

    switch (channelRoute.name) {
      case 'channel':
        return this.channelRoute(channel, channelRoute.messageId ?? null, expanded, toggle);
      case 'thread':
        return this.threadRoute(channel, channelRoute.threadId, channelRoute.messageId ?? null, expanded, toggle);
      default:
        return this.channelSubRoute(channel, channelRoute, expanded, toggle);
    }
  }

  private listTitle(name: string): string {
    return (
      {
        channels: ct('channel_list.title'),
        'direct-messages': ct('direct_messages.title'),
        threads: ct('my_threads.title'),
        search: ct('search.title'),
      }[name] || ct('heading')
    );
  }

  private listBody(route: ChatRoute): Mithril.Children {
    const inDrawer = this.attrs.inDrawer;

    switch (route.name) {
      case 'direct-messages': {
        // Sem `false` no meio: numa lista com `key`, o Mithril recusa um item sem.
        const items: Mithril.Children[] = [<ChannelsList key="dm" which="direct" inDrawer={inDrawer} />];

        if (app.screen() === 'phone' && caps().canDirectMessage) {
          items.push(
            <button
              key="fab"
              type="button"
              className="Button btn-floating open-new-message-btn"
              aria-label={ct('direct_messages.new_group')}
              onclick={() => go({ name: 'new-message' }, inDrawer)}
            >
              <Icon name="fas fa-plus" />
            </button>
          );
        }

        return items;
      }
      case 'threads':
        return <ThreadList key="threads" inDrawer={inDrawer} />;
      case 'search':
        return <ChatSearch key="search" inDrawer={inDrawer} />;
      default:
        return <ChannelsList key="channels" which={inDrawer || app.screen() === 'phone' ? 'public' : 'all'} inDrawer={inDrawer} />;
    }
  }

  /** Na página cheia: "Fechar chat em tela cheia" leva a conversa para a gaveta. */
  private pageButtons(route?: ChatRoute): NavbarButton[] {
    if (this.attrs.inDrawer || app.screen() === 'phone') return [];

    return [
      {
        key: 'drawer',
        icon: 'fas fa-down-left-and-up-right-to-center',
        title: ct('close_full_page'),
        className: 'c-navbar__open-drawer-button',
        onclick: () => chat.closeFullPage(route || this.attrs.route),
      },
    ];
  }

  private loadChannel(id: number): Mithril.Children {
    if (this.missing.has(id)) {
      return (
        <div className="c-drawer-routes c-routes --missing">
          {Navbar({ title: ct('heading'), back: () => go({ name: 'channels' }, this.attrs.inDrawer), actions: drawerButtons(this.attrs.inDrawer) })}
          <div className="chat-drawer-content">
            <div className="chat-channel-preview-card --no-access">
              <div className="chat-channel-preview-card__icon">
                <Icon name="fas fa-lock" />
              </div>
              <div className="chat-channel-preview-card__title">{ct('invalid_access')}</div>
            </div>
          </div>
        </div>
      );
    }

    if (this.loadingChannel !== id) {
      this.loadingChannel = id;

      ensureChannel(id).then((channel) => {
        if (!channel) this.missing.add(id);
        this.loadingChannel = null;
        m.redraw();
      });
    }

    return <LoadingIndicator />;
  }

  private back(channel: Channel): (() => void) | undefined {
    if (this.attrs.sideList) return undefined;

    return () => go({ name: channel.type === 'direct' ? 'direct-messages' : 'channels' }, this.attrs.inDrawer);
  }

  private channelRoute(channel: Channel, messageId: number | null, expanded: boolean, toggle?: () => void): Mithril.Children {
    const inDrawer = this.attrs.inDrawer;
    const membership = channel.membership;
    const actions: NavbarButton[] = [];

    if (caps().pins) {
      actions.push({
        key: 'pins',
        icon: 'fas fa-thumbtack',
        title: ct('pinned_messages.title'),
        className: 'c-navbar__pinned-messages-btn',
        onclick: () => go({ name: 'channel-pins', channelId: channel.id }, inDrawer),
        indicator: membership?.hasUnseenPins ? <span className="c-unread-indicator" /> : null,
      });
    }

    if (channel.threadingEnabled) {
      actions.push({
        key: 'threads',
        icon: 'fas fa-list-ul',
        title: ct('threads.list'),
        className: classList('c-navbar__threads-list-button', { 'has-unreads': (membership?.unreadThreadsCount || 0) > 0 }),
        onclick: () => go({ name: 'channel-threads', channelId: channel.id }, inDrawer),
        indicator: (membership?.unreadThreadsCount || 0) > 0 ? UnreadIndicator(0, true, 'c-unread-indicator') : null,
      });
    }

    actions.push({
      key: 'info',
      icon: 'fas fa-gear',
      title: ct('settings.info_title'),
      className: 'c-navbar__info-button',
      onclick: () => go({ name: 'channel-info', channelId: channel.id, tab: 'settings' }, inDrawer),
    });

    const title = (
      <button
        type="button"
        className="c-navbar__channel-title"
        onclick={(e: MouseEvent) => {
          e.stopPropagation();
          go({ name: 'channel-info', channelId: channel.id, tab: channel.type === 'direct' ? 'members' : 'settings' }, inDrawer);
        }}
      >
        {ChannelTitle(channel)}
      </button>
    );

    const pane = chat.pane(channel.id);

    return (
      <div className="c-drawer-routes c-routes --channel" data-chat-channel-id={channel.id}>
        {Navbar({ title, back: this.back(channel), actions: [...actions, ...this.pageButtons(), ...drawerButtons(inDrawer)], onclick: toggle })}
        {expanded && (
          <div className="chat-drawer-content">
            {/* A chave troca o componente ao mudar de canal: cada um com a própria rolagem. */}
            {[<ChatChannel key={pane.key} pane={pane} targetMessageId={messageId} context="channel" />]}
          </div>
        )}
        {channel.status !== 'open' && expanded && (
          <div className="chat-channel-status">
            <Icon name={channel.status === 'archived' ? 'fas fa-box-archive' : 'fas fa-lock'} /> {ct(`channel_status.${channel.status}_header`)}
          </div>
        )}
      </div>
    );
  }

  private threadRoute(channel: Channel, threadId: number, messageId: number | null, expanded: boolean, toggle?: () => void): Mithril.Children {
    const inDrawer = this.attrs.inDrawer;
    const thread = chat.threads.get(threadId);

    if (!thread) {
      chat.fetchThread(threadId).catch(() => {});
    }

    const pane = chat.pane(channel.id, threadId);
    const level = thread?.membership?.notificationLevel || 'tracking';

    const tracking = (
      <Dropdown
        className="c-navbar__thread-tracking-dropdown"
        buttonClassName="Button Button--icon Button--flat"
        icon={level === 'watching' ? 'fas fa-circle-exclamation' : level === 'tracking' ? 'fas fa-circle-dot' : 'far fa-circle'}
        caretIcon={null}
        menuClassName="Dropdown-menu--right"
        accessibleToggleLabel={ct('thread.settings')}
      >
        {(['regular', 'tracking', 'watching'] as ThreadLevel[]).map((value) => (
          <Button
            className={classList('thread-tracking-option', { active: level === value })}
            icon={level === value ? 'fas fa-check' : 'fas'}
            onclick={() => this.setLevel(threadId, value)}
          >
            <span className="thread-tracking-option__title">{ct(`thread.notifications.${value}.title`)}</span>
            <span className="thread-tracking-option__description">{ct(`thread.notifications.${value}.description`)}</span>
          </Button>
        ))}
      </Dropdown>
    );

    const title = (
      <span className="chat-thread-header__label">
        <Icon name="fas fa-list-ul" /> {thread?.title || ct('thread.label')}
      </span>
    );

    const closeThread: NavbarButton[] = !inDrawer
      ? [
          {
            key: 'close-thread',
            icon: 'fas fa-xmark',
            title: ct('thread.close'),
            className: 'c-navbar__close-thread-button',
            onclick: () => go({ name: 'channel', channelId: channel.id }, false),
          },
        ]
      : [];

    return (
      <div className="c-drawer-routes c-routes --channel-thread chat-thread" data-chat-thread-id={threadId}>
        <div className="chat-thread-header-container">
          {Navbar({
            title,
            subTitle: inDrawer ? channelTitle(channel) : undefined,
            back: inDrawer ? () => go({ name: 'channel', channelId: channel.id }, true) : undefined,
            actions: [...closeThread, ...drawerButtons(inDrawer)],
            onclick: toggle,
          })}
          {expanded && <div className="c-navbar__thread-actions">{tracking}</div>}
        </div>
        {expanded && (
          <div className="chat-drawer-content">{[<ChatChannel key={pane.key} pane={pane} targetMessageId={messageId} context="thread" />]}</div>
        )}
      </div>
    );
  }

  private async setLevel(threadId: number, level: ThreadLevel): Promise<void> {
    const result = await chatRequest('PATCH', `/threads/${threadId}`, { notificationLevel: level });

    pushUsers(result.users);
    chat.threads.set(threadId, result.thread);
    m.redraw();
  }

  private channelSubRoute(channel: Channel, route: ChatRoute, expanded: boolean, toggle?: () => void): Mithril.Children {
    const inDrawer = this.attrs.inDrawer;
    let title: Mithril.Children = '';
    let body: Mithril.Children = null;

    if (route.name === 'channel-threads') {
      title = ct('threads.list');
      body = <ThreadList channelId={channel.id} inDrawer={inDrawer} />;
    } else if (route.name === 'channel-pins') {
      title = ct('pinned_messages.title');
      body = <PinsList channelId={channel.id} inDrawer={inDrawer} />;
    } else if (route.name === 'channel-info') {
      title = ct('settings.info_title');
      body = <ChannelInfo channel={channel} tab={route.tab} inDrawer={inDrawer} />;
    }

    return (
      <div className={`c-drawer-routes c-routes --${route.name}`}>
        {Navbar({
          title,
          back: () => go({ name: 'channel', channelId: channel.id }, inDrawer),
          actions: drawerButtons(inDrawer),
          onclick: toggle,
          subTitle: channelTitle(channel),
        })}
        {expanded && <div className="chat-drawer-content">{body}</div>}
      </div>
    );
  }
}
