/*
 * As listas de canais (públicos e diretos) e as abas
 * do rodapé da gaveta (c-footer: Canais, MDs, Meus tópicos, Pesquisar).
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat, { routeUrl } from '../ChatStore';
import { ChannelIcon, ChannelName, UnreadIndicator } from './bits';
import * as api from '../api';
import { caps, ct, messageTime } from '../utils';
import type { ChatChannel, ChatRoute } from '../types';

/** Vai para uma rota do chat: dentro da gaveta, ou pela URL na página cheia. */
export function go(route: ChatRoute, inDrawer: boolean): void {
  if (inDrawer) chat.navigate(route);
  else m.route.set(routeUrl(route, chat));
}

export interface ChannelsListAttrs extends ComponentAttrs {
  which: 'public' | 'direct' | 'all';
  inDrawer: boolean;
}

export default class ChannelsList extends Component<ChannelsListAttrs> {
  view(): Mithril.Children {
    const { which, inDrawer } = this.attrs;

    return (
      <div className={classList('channels-list', { 'public-channels': which === 'public', 'direct-message-channels': which === 'direct' })}>
        {which !== 'direct' && this.publicSection(inDrawer, which === 'all')}
        {which !== 'public' && caps().canDirectMessage && this.directSection(inDrawer, which === 'all')}
      </div>
    );
  }

  private publicSection(inDrawer: boolean, withDivider: boolean): Mithril.Children {
    const channels = chat.publicChannels();

    return (
      <div className="channels-list-container public-channels">
        {(withDivider || inDrawer) && (
          <div className="chat-channel-divider public-channels-section">
            <span className="channel-title">{ct('chat_channels')}</span>
            <div className="chat-channel-divider__actions">
              <Tooltip text={ct('browse_all_channels')}>
                <button
                  type="button"
                  className="Button Button--icon Button--flat open-browse-page-btn"
                  aria-label={ct('browse_all_channels')}
                  onclick={() => go({ name: 'browse' }, inDrawer)}
                >
                  <Icon name="fas fa-pencil" />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
        {channels.length ? (
          channels.map((channel) => <ChannelRow key={channel.id} channel={channel} inDrawer={inDrawer} />)
        ) : chat.loaded ? (
          <div className="channels-list__empty">
            <p>{ct('no_public_channels')}</p>
            <button type="button" className="Button Button--primary" onclick={() => go({ name: 'browse' }, inDrawer)}>
              {ct('no_public_channels_cta')}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  private directSection(inDrawer: boolean, withDivider: boolean): Mithril.Children {
    const channels = chat.directChannels();

    return (
      <div className="channels-list-container direct-message-channels">
        {(withDivider || inDrawer) && (
          <div className="chat-channel-divider direct-message-channels-section">
            <span className="channel-title">{ct('direct_messages.title')}</span>
            <div className="chat-channel-divider__actions">
              <Tooltip text={ct('direct_messages.new_group')}>
                <button
                  type="button"
                  className="Button Button--icon Button--flat open-draft-channel-page-btn"
                  aria-label={ct('direct_messages.new_group')}
                  onclick={() => go({ name: 'new-message' }, inDrawer)}
                >
                  <Icon name="fas fa-plus" />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
        {channels.length ? (
          channels.map((channel) => <ChannelRow key={channel.id} channel={channel} inDrawer={inDrawer} leave />)
        ) : chat.loaded ? (
          <div className="channels-list__empty">
            <p>{ct('no_direct_message_channels')}</p>
            <button type="button" className="Button Button--primary" onclick={() => go({ name: 'new-message' }, inDrawer)}>
              {ct('no_direct_message_channels_cta')}
            </button>
          </div>
        ) : null}
      </div>
    );
  }
}

export interface ChannelRowAttrs extends ComponentAttrs {
  channel: ChatChannel;
  inDrawer: boolean;
  leave?: boolean;
}

export class ChannelRow extends Component<ChannelRowAttrs> {
  private leaving = false;

  view(): Mithril.Children {
    const { channel, inDrawer, leave } = this.attrs;
    const urgent = chat.urgent(channel);
    const unread = chat.unread(channel) > 0;
    const active = chat.activeChannelId === channel.id && !inDrawer;
    const last = channel.lastMessage;

    return (
      <a
        className={classList('chat-channel-row', {
          active,
          muted: channel.membership?.muted,
          'has-unread': unread || urgent > 0,
          'can-leave': leave,
          unfollowing: this.leaving,
          '-fade-out': this.leaving,
        })}
        href={routeUrl({ name: 'channel', channelId: channel.id }, chat)}
        data-chat-channel-id={channel.id}
        onclick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.button !== 0) return;
          e.preventDefault();
          go({ name: 'channel', channelId: channel.id }, inDrawer);
        }}
      >
        <div className={classList('chat-channel-row__content', channel.type === 'public' ? 'is-category' : 'is-dm')}>
          {ChannelIcon(channel)}
          <div className="chat-channel-row__info">
            <div className="chat-channel-row__name-container">
              {ChannelName(channel)}
              {channel.membership?.starred && (
                <span className="chat-channel-row__starred-icon">
                  <Icon name="fas fa-star" />
                </span>
              )}
            </div>
            <div className="chat-channel__metadata">
              {channel.type === 'direct' && last && <div className="chat-channel__metadata-date">{messageTime(new Date(last.createdAt))}</div>}
              {UnreadIndicator(urgent, unread)}
            </div>
            {channel.type === 'direct' && app.screen() === 'phone' && last && <div className="chat-channel__last-message">{last.excerpt}</div>}
          </div>
          {leave && app.screen() !== 'phone' && (
            <button
              type="button"
              className="Button Button--icon Button--flat chat-channel-leave-btn toggle-channel-membership-button -leave"
              title={ct('direct_messages.close')}
              aria-label={ct('direct_messages.close')}
              onclick={(e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                this.leave();
              }}
            >
              <Icon name="fas fa-xmark" />
            </button>
          )}
        </div>
      </a>
    );
  }

  /** O "x" da MD: some da lista com uma animação e sai da conversa. */
  private async leave(): Promise<void> {
    const channel = this.attrs.channel;

    this.leaving = true;
    m.redraw();

    try {
      await api.leave(channel.id);
      setTimeout(() => {
        if (channel.membership) channel.membership.following = false;
        m.redraw();
      }, 250);
    } catch {
      this.leaving = false;
    }
  }
}

export interface ChatFooterAttrs extends ComponentAttrs {
  current: string;
  inDrawer: boolean;
}

/** As abas de baixo (gaveta e celular), com o pontinho/número de cada uma. */
export class ChatFooter extends Component<ChatFooterAttrs> {
  view(): Mithril.Children {
    const { current, inDrawer } = this.attrs;
    const totals = chat.totals();
    const publicUnread = chat.publicChannels().some((c) => chat.unread(c) > 0);
    const c = caps();

    const tab = (name: ChatRoute['name'], icon: string, label: string, indicator: Mithril.Children) => (
      <button
        type="button"
        className={classList('Button Button--flat c-footer__item', { '--active': current === name })}
        id={`c-footer-${name}`}
        aria-label={label}
        onclick={() => go({ name } as ChatRoute, inDrawer)}
      >
        <Icon name={icon} />
        <span className="c-footer__label">{label}</span>
        {indicator}
      </button>
    );

    return (
      <nav className="c-footer">
        {tab('channels', 'fas fa-comments', ct('channel_list.title'), UnreadIndicator(totals.publicUrgent, publicUnread, 'c-unread-indicator'))}
        {c.canDirectMessage &&
          tab('direct-messages', 'fas fa-users', ct('direct_messages.title'), UnreadIndicator(totals.dmUrgent, false, 'c-unread-indicator'))}
        {c.threads && tab('threads', 'fas fa-list-ul', ct('my_threads.title'), UnreadIndicator(0, totals.threads > 0, 'c-unread-indicator'))}
        {tab('search', 'fas fa-magnifying-glass', ct('search.short_title'), null)}
      </nav>
    );
  }
}

/** Carrega um canal que ainda não está no estado (um link direto, uma prévia). */
export async function ensureChannel(id: number): Promise<ChatChannel | null> {
  const known = chat.channels.get(id);

  if (known) return known;

  try {
    const result = await api.channel(id);

    return chat.putChannel(result.channel);
  } catch {
    return null;
  }
}
