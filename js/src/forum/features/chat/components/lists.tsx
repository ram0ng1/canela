/*
 * As listas secundárias do chat: os fios de um canal (chat-thread-list), os
 * meus fios ("Meus fios", c-user-threads), as fixadas
 * (chat-pinned-messages-list) e a busca nas mensagens (c-search).
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat from '../ChatStore';
import ChatMessage, { relativeAgo } from './ChatMessage';
import { ChannelTitle, ChatUserAvatar, UnreadIndicator } from './bits';
import { go } from './ChannelsList';
import * as api from '../api';
import { chatUser, ct, displayName } from '../utils';
import type { ChatMessage as Message, ChatThread } from '../types';

function threadTitle(thread: ChatThread): string {
  return thread.title || thread.originalMessage?.excerpt || ct('thread.label');
}

function ThreadItem(thread: ChatThread, inDrawer: boolean, withChannel: boolean): Mithril.Children {
  const original = thread.originalMessage;
  const unread = thread.membership?.unreadCount || 0;

  return (
    <div
      key={thread.id}
      className={classList('chat-thread-list-item', { 'c-user-thread': withChannel })}
      role="button"
      tabindex="0"
      onclick={() => go({ name: 'thread', channelId: thread.channelId, threadId: thread.id }, inDrawer)}
    >
      <div className="chat-thread-list-item__main">
        {withChannel && chat.channels.get(thread.channelId) && (
          <div className="chat-thread-list-item__channel">{ChannelTitle(chat.channels.get(thread.channelId)!)}</div>
        )}
        <div className="chat-thread-list-item__header">
          <div className="chat-thread-list-item__om-user-avatar">{ChatUserAvatar(original?.userId, { interactive: false })}</div>
          <div className="chat-thread-list-item__title">
            <span className="chat__thread-title__name">{threadTitle(thread)}</span>
          </div>
          <div className="chat-thread-list-item__unread-indicator">
            {unread > 0 && UnreadIndicator(0, true, 'chat-thread-list-item-unread-indicator')}
          </div>
        </div>
        <div className="chat-thread-list-item__body">
          {thread.lastReplyUserId && (
            <span className="chat-thread-list-item__last-reply-author">{chatUser(thread.lastReplyUserId)?.username()}: </span>
          )}
          <span className="chat-thread-list-item__last-reply-excerpt">{thread.lastReplyExcerpt}</span>
        </div>
        <div className="chat-thread-list-item__metadata">
          <div className="chat-thread-list-item__members">
            <div className="chat-thread-list-item__participants">
              <div className="chat-thread-participants__avatar-group">
                {thread.participantIds.map((id) => ChatUserAvatar(id, { interactive: false, size: 'tiny' }))}
              </div>
            </div>
            <span className="chat-thread-list-item__replies">{ct('thread.replies', { count: thread.replyCount })}</span>
          </div>
          {thread.lastReplyCreatedAt && (
            <div className="chat-thread-list-item__last-reply-timestamp">{relativeAgo(new Date(thread.lastReplyCreatedAt))}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ThreadListAttrs extends ComponentAttrs {
  channelId?: number;
  inDrawer: boolean;
}

/** Os fios de um canal, ou — sem canal — os do leitor em todos os canais. */
export class ThreadList extends Component<ThreadListAttrs> {
  private threads: ChatThread[] | null = null;

  oninit(vnode: Mithril.Vnode<ThreadListAttrs, this>) {
    super.oninit(vnode);
    this.load();
  }

  private async load(): Promise<void> {
    const result = await api.threads(this.attrs.channelId || undefined);

    result.channels.forEach((channel) => chat.channels.has(channel.id) || chat.putChannel(channel));
    this.threads = result.threads;
    m.redraw();
  }

  view(): Mithril.Children {
    const mine = !this.attrs.channelId;

    if (!this.threads) return <LoadingIndicator />;

    if (!this.threads.length) {
      return (
        <div className={mine ? 'c-user-threads empty-state-threads' : 'chat-thread-list__no-threads'}>
          {mine ? ct('empty_state.my_threads') : ct('threads.none')}
        </div>
      );
    }

    return (
      <div className={mine ? 'c-user-threads c-list' : 'chat-thread-list__items'}>
        {this.threads.map((thread) => ThreadItem(thread, this.attrs.inDrawer, mine))}
      </div>
    );
  }
}

export interface PinsListAttrs extends ComponentAttrs {
  channelId: number;
  inDrawer: boolean;
}

/** "Mensagens fixadas": a lista, do mais recente, com quem fixou e o desafixar. */
export class PinsList extends Component<PinsListAttrs> {
  private messages: Message[] | null = null;

  oninit(vnode: Mithril.Vnode<PinsListAttrs, this>) {
    super.oninit(vnode);

    api.pins(this.attrs.channelId).then((result) => {
      this.messages = result.messages;
      m.redraw();
    });

    // Abrir a lista é "ver" as fixadas: o pontinho some.
    api.pinsRead(this.attrs.channelId).catch(() => {});

    const membership = chat.channels.get(this.attrs.channelId)?.membership;
    if (membership) membership.hasUnseenPins = false;
  }

  view(): Mithril.Children {
    if (!this.messages) return <LoadingIndicator />;

    const pane = chat.pane(this.attrs.channelId);

    if (!this.messages.length) return <div className="chat-pinned-messages-list__empty">{ct('no_pinned_messages')}</div>;

    return (
      <div className="chat-pinned-messages-list chat-messages-scroller">
        <div className="chat-messages-container">
          {this.messages.map((message) => (
            <div key={message.id} className="chat-pinned-message">
              <a
                className="chat-pinned-message__link"
                href="#"
                onclick={(e: MouseEvent) => {
                  e.preventDefault();
                  go({ name: 'channel', channelId: this.attrs.channelId, messageId: message.id }, this.attrs.inDrawer);
                }}
              >
                <div className="chat-pinned-message__pinned-by">
                  <Icon name="fas fa-thumbtack" className="chat-pinned-message__pinned-by-icon" />
                  {message.pinnedById === Number(app.session.user?.id())
                    ? ct('pinned_messages.pinned_by_you')
                    : ct('pinned_messages.pinned_by_user', { username: displayName(message.pinnedById) })}
                </div>
                <ChatMessage message={message} pane={pane} context="pinned" interactive={false} separator={false} />
              </a>
              {pane.channel?.canPin && (
                <button
                  type="button"
                  className="Button Button--icon Button--flat chat-pinned-message__unpin"
                  aria-label={ct('unpin_message')}
                  title={ct('unpin_message')}
                  onclick={() => this.unpin(message)}
                >
                  <Icon name="fas fa-xmark" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  private async unpin(message: Message): Promise<void> {
    const result = await api.pin(message.id, false);

    chat.upsertEverywhere(result.message);
    this.messages = (this.messages || []).filter((m) => m.id !== message.id);
    m.redraw();
  }
}

export interface ChatSearchAttrs extends ComponentAttrs {
  inDrawer: boolean;
  channelId?: number;
}

/** "Pesquisar no chat": nas mensagens de todos os canais, por relevância ou data. */
export class ChatSearch extends Component<ChatSearchAttrs> {
  private query = '';
  private sort: 'relevance' | 'latest' = 'relevance';
  private results: Message[] | null = null;
  private loading = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  view(): Mithril.Children {
    return (
      <div className="c-search">
        <div className="chat-search__filters">
          <div className="filter-input-container">
            <Icon name="fas fa-magnifying-glass" className="filter-input-icon" />
            <input
              className="FormControl filter-input"
              type="search"
              placeholder={ct('search_view.filter_placeholder')}
              value={this.query}
              oncreate={(vnode: Mithril.VnodeDOM) => (vnode.dom as HTMLInputElement).focus()}
              oninput={(e: InputEvent) => {
                this.query = (e.target as HTMLInputElement).value;
                this.schedule();
              }}
            />
          </div>
          <select
            className="FormControl chat-search__sort"
            value={this.sort}
            onchange={(e: Event) => {
              this.sort = (e.target as HTMLSelectElement).value as any;
              this.search();
            }}
          >
            <option value="relevance">{ct('search.sort.relevance')}</option>
            <option value="latest">{ct('search.sort.latest')}</option>
          </select>
        </div>
        {this.loading && <LoadingIndicator />}
        {!this.loading && this.results && !this.results.length && <div className="chat-search__empty">{ct('search.no_results')}</div>}
        {!this.loading && this.results && this.results.length > 0 && (
          <ul className="chat-message-search-entries" aria-label={ct('search_view.results_list_label')}>
            {this.results.map((message) => {
              const channel = chat.channels.get(message.channelId);

              return (
                <li
                  key={message.id}
                  className="chat-message-search-entry"
                  tabindex="0"
                  onclick={() =>
                    go(
                      message.threadId && !message.isThreadOriginal
                        ? { name: 'thread', channelId: message.channelId, threadId: message.threadId, messageId: message.id }
                        : { name: 'channel', channelId: message.channelId, messageId: message.id },
                      this.attrs.inDrawer
                    )
                  }
                >
                  <div className="chat-message-search-entry__info">{channel && ChannelTitle(channel)}</div>
                  <ChatMessage message={message} pane={chat.pane(message.channelId)} context="search" interactive={false} separator={false} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search(), 300);
  }

  private async search(): Promise<void> {
    if (this.query.trim().length < 2) {
      this.results = null;
      m.redraw();
      return;
    }

    this.loading = true;
    m.redraw();

    try {
      const result = await api.search(this.query.trim(), this.sort, this.attrs.channelId);
      result.channels.forEach((channel) => chat.channels.has(channel.id) || chat.putChannel(channel));
      this.results = result.results;
    } finally {
      this.loading = false;
      m.redraw();
    }
  }
}
