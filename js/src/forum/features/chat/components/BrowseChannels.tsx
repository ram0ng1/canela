/*
 * "Navegar por todos os canais": os filtros
 * Tudo/Aberto/Fechados/Arquivados, a busca por nome e os cartões dos canais,
 * cada um com "Participar" ou "Sair".
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat from '../ChatStore';
import { ChannelIcon } from './bits';
import { go } from './ChannelsList';
import { CreateChannelModal } from './modals';
import * as api from '../api';
import { caps, ct } from '../utils';
import type { ChatChannel } from '../types';

const FILTERS = ['all', 'open', 'closed', 'archived'] as const;

export interface BrowseChannelsAttrs extends ComponentAttrs {
  filter?: string;
  inDrawer: boolean;
}

export default class BrowseChannels extends Component<BrowseChannelsAttrs> {
  private filter = 'all';
  private query = '';
  private channels: ChatChannel[] | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private busy = new Set<number>();

  oninit(vnode: Mithril.Vnode<BrowseChannelsAttrs, this>) {
    super.oninit(vnode);

    this.filter = FILTERS.includes(this.attrs.filter as any) ? this.attrs.filter! : 'all';
    this.load();
  }

  private async load(): Promise<void> {
    const result = await api.browse({ status: this.filter, q: this.query });

    this.channels = result.channels.map((channel) => (chat.channels.has(channel.id) ? chat.putChannel(channel) : channel));
    m.redraw();
  }

  view(): Mithril.Children {
    const inDrawer = this.attrs.inDrawer;

    return (
      <div className="chat-browse-view">
        {!inDrawer && (
          <div className="chat-browse-view__header">
            <h2 className="chat-browse-view__title">{ct('browse.title')}</h2>
          </div>
        )}
        <div className="chat-browse-view__actions">
          <nav>
            <ul className="nav-pills chat-browse-view__filters">
              {FILTERS.map((filter) => (
                <li className={classList('chat-browse-view__filter', { active: this.filter === filter })}>
                  <a
                    href="#"
                    className={classList('chat-browse-view__filter-link', { active: this.filter === filter })}
                    onclick={(e: MouseEvent) => {
                      e.preventDefault();
                      this.filter = filter;
                      this.channels = null;
                      this.load();
                    }}
                  >
                    {ct(`browse.filter_${filter}`)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="d-filter-controls">
            <div className="filter-input-container">
              <Icon name="fas fa-magnifying-glass" className="filter-input-icon" />
              <input
                className="FormControl filter-input"
                type="search"
                placeholder={ct('browse.filter_input_placeholder')}
                value={this.query}
                oninput={(e: InputEvent) => {
                  this.query = (e.target as HTMLInputElement).value;
                  if (this.timer) clearTimeout(this.timer);
                  this.timer = setTimeout(() => this.load(), 250);
                }}
              />
            </div>
            {caps().canCreateChannel && (
              <Button
                className="Button Button--primary new-channel-btn"
                icon="fas fa-plus"
                onclick={() => app.modal.show(CreateChannelModal, { inDrawer })}
              >
                {ct('create_channel.title')}
              </Button>
            )}
          </div>
        </div>
        <div className="chat-browse-view__content_wrapper">
          {!this.channels ? (
            <LoadingIndicator />
          ) : this.channels.length ? (
            <div className="chat-browse-view__cards">{this.channels.map((channel) => this.card(channel))}</div>
          ) : (
            <div className="empty-state">
              <span className="empty-state__title">{ct('empty_state.title')}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  private card(channel: ChatChannel): Mithril.Children {
    const following = !!channel.membership?.following;

    return (
      <div
        key={channel.id}
        className={classList('chat-channel-card', `--${channel.status}`)}
        style={{ '--chat-channel-card-border': channel.tag?.color || 'transparent' }}
      >
        <div className="chat-channel-card__header">
          <a
            className="chat-channel-card__name-container"
            href="#"
            onclick={(e: MouseEvent) => {
              e.preventDefault();
              chat.putChannel(channel);
              go({ name: 'channel', channelId: channel.id }, this.attrs.inDrawer);
            }}
          >
            {ChannelIcon(channel)}
            <span className="chat-channel-card__name">{channel.name}</span>
            {channel.membership?.muted && (
              <span className="chat-channel-card__muted">
                <Icon name="fas fa-volume-xmark" />
              </span>
            )}
          </a>
        </div>
        <div className="chat-channel-card__members">{ct('channel.memberships_count', { count: channel.userCount })}</div>
        {channel.description && <div className="chat-channel-card__description">{channel.description}</div>}
        <div className="chat-channel-card__cta">
          {channel.status !== 'archived' && (
            <Button
              className={classList('Button toggle-channel-membership-button', following ? '-leave' : 'Button--primary -join')}
              loading={this.busy.has(channel.id)}
              onclick={() => this.toggle(channel)}
            >
              {following ? ct('channel_settings.leave') : ct('channel_settings.join')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  private async toggle(channel: ChatChannel): Promise<void> {
    const following = !!channel.membership?.following;

    this.busy.add(channel.id);

    try {
      const result = following ? await api.leave(channel.id) : await api.follow(channel.id);

      if (result.channel) {
        Object.assign(channel, result.channel);
        chat.putChannel(channel);
      }
    } finally {
      this.busy.delete(channel.id);
      m.redraw();
    }
  }
}
