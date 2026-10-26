/*
 * "Nova mensagem": uma busca só por
 * canais (#) e pessoas (@). Escolher uma pessoa abre a MD com ela; Shift+clique
 * (ou Shift+Enter) a junta a um chat em grupo. "Novo chat em grupo" abre o
 * seletor de participantes, com o nome opcional do grupo e o contador.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat from '../ChatStore';
import { ChannelTitle, ChatUserAvatar, UnreadIndicator } from './bits';
import { go } from './ChannelsList';
import { caps, chatRequest, chatUser, ct, meId, pushUsers } from '../utils';
import type { ChatChannel } from '../types';

type Item = { type: 'channel'; channel: ChatChannel } | { type: 'user'; id: number } | { type: 'group' };

export interface MessageCreatorAttrs extends ComponentAttrs {
  inDrawer: boolean;
  /** Modo "Adicionar membros" de um canal existente. */
  addTo?: ChatChannel;
  onadded?: () => void;
}

export default class MessageCreator extends Component<MessageCreatorAttrs> {
  private query = '';
  private users: number[] = [];
  private index = 0;
  private group = false;
  private members: number[] = [];
  private groupName = '';
  private busy = false;
  private request = 0;

  oninit(vnode: Mithril.Vnode<MessageCreatorAttrs, this>) {
    super.oninit(vnode);

    this.group = !!this.attrs.addTo;
    this.search();
  }

  view(): Mithril.Children {
    const items = this.items();
    const max = caps().dmMaxUsers || 20;

    return (
      <div className="chat-message-creator-container">
        <div className="chat-message-creator">
          <div className="chat-message-creator__container">
            {this.group ? (
              <div className="chat-message-creator__add-members">
                {!this.attrs.addTo && (
                  <div className="chat-message-creator__new-group-header-container">
                    <div className="chat-message-creator__new-group-header">
                      <input
                        className="FormControl chat-message-creator__new-group-header__input"
                        placeholder={ct('new_message_modal.create_group_placeholder')}
                        maxlength={100}
                        value={this.groupName}
                        oninput={(e: InputEvent) => (this.groupName = (e.target as HTMLInputElement).value)}
                      />
                    </div>
                  </div>
                )}
                <div className="chat-message-creator__add-members-header-container">
                  <div className="chat-message-creator__add-members-header">
                    <div className="chat-message-creator__members-container">
                      <div className="chat-message-creator__members">
                        <Icon name="fas fa-magnifying-glass" />
                        {this.members.map((id) => (
                          <button
                            key={id}
                            type="button"
                            className="Button chat-message-creator__member"
                            title={ct('direct_message_creator.selected_user_title', { username: chatUser(id)?.username() })}
                            onclick={() => this.toggleMember(id)}
                          >
                            {ChatUserAvatar(id, { interactive: false })}
                            <span>{chatUser(id)?.username()}</span>
                            <Icon name="fas fa-xmark" />
                          </button>
                        ))}
                        {this.input(ct('new_message_modal.user_search_placeholder'))}
                      </div>
                      <div className={classList('chat-message-creator__members-count', { '-reached-limit': this.members.length + 1 >= max })}>
                        {ct('new_message_modal.participants_counter', { selection_count: this.members.length + 1, max })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="chat-message-creator__search-input-container">
                <div className="chat-message-creator__search-input">
                  <Icon name="fas fa-magnifying-glass" className="chat-message-creator__search-input__search-icon" />
                  {this.input(ct('new_message_modal.default_search_placeholder'))}
                </div>
              </div>
            )}

            <div className="chat-message-creator__list-container">
              <ul className="chat-message-creator__list">
                {items.length === 0 && <li className="chat-message-creator__list-item -empty">{ct('new_message_modal.no_items')}</li>}
                {items.map((item, index) => this.row(item, index))}
              </ul>
            </div>

            {this.group && (
              <div className="chat-message-creator__new-group-footer-container">
                <div className="chat-message-creator__new-group-footer">
                  {!this.attrs.addTo && (
                    <Button className="Button" onclick={() => (this.group = false)}>
                      {ct('cancel')}
                    </Button>
                  )}
                  <Button
                    className="Button Button--primary"
                    loading={this.busy}
                    disabled={!this.members.length}
                    onclick={() => (this.attrs.addTo ? this.addMembers() : this.open(this.members, this.groupName))}
                  >
                    {this.attrs.addTo ? ct('direct_message_creator.add_to_channel') : ct('new_message_modal.create_new_group_chat')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  private input(placeholder: string): Mithril.Children {
    return (
      <input
        className="FormControl chat-message-creator__search-input__input chat-message-creator__members-input"
        placeholder={placeholder}
        value={this.query}
        oncreate={(vnode: Mithril.VnodeDOM) => (vnode.dom as HTMLInputElement).focus()}
        oninput={(e: InputEvent) => {
          this.query = (e.target as HTMLInputElement).value;
          this.index = 0;
          this.search();
        }}
        onkeydown={(e: KeyboardEvent) => this.keydown(e)}
      />
    );
  }

  private items(): Item[] {
    const query = this.query.trim().toLowerCase();
    const wantsChannels = !this.group && !query.startsWith('@');
    const wantsUsers = !query.startsWith('#');
    const term = query.replace(/^[#@]/, '');
    const items: Item[] = [];

    if (!this.group && !query && caps().canDirectMessage) items.push({ type: 'group' });

    if (wantsChannels) {
      [...chat.publicChannels(), ...chat.directChannels()]
        .filter(
          (channel) =>
            !term ||
            (channel.name || '').toLowerCase().includes(term) ||
            (channel.type === 'direct' && channel.participantIds.some((id) => chatUser(id)?.username().toLowerCase().includes(term)))
        )
        .slice(0, query ? 10 : 5)
        .forEach((channel) => items.push({ type: 'channel', channel }));
    }

    if (wantsUsers && caps().canDirectMessage) {
      this.users.filter((id) => id !== meId() || !this.group).forEach((id) => items.push({ type: 'user', id }));
    }

    return items;
  }

  private row(item: Item, index: number): Mithril.Children {
    const highlighted = index === this.index;

    if (item.type === 'group') {
      return (
        <li
          key="group"
          className={classList('chat-message-creator__list-item -group', { '-highlighted': highlighted })}
          onclick={() => (this.group = true)}
          onmouseenter={() => (this.index = index)}
        >
          <span className="chat-message-creator__group-icon">
            <Icon name="fas fa-users" />
          </span>
          <span className="chat-message-creator__group-name">{ct('new_message_modal.new_group_chat')}</span>
        </li>
      );
    }

    if (item.type === 'channel') {
      const channel = item.channel;

      return (
        <li
          key={`c${channel.id}`}
          className={classList('chat-message-creator__list-item', { '-highlighted': highlighted })}
          onclick={() => go({ name: 'channel', channelId: channel.id }, this.attrs.inDrawer)}
          onmouseenter={() => (this.index = index)}
        >
          <div className={classList('chat-message-creator__chatable', channel.type === 'public' ? '-category-channel' : '-dm-channel')}>
            {ChannelTitle(channel)}
            {UnreadIndicator(chat.urgent(channel), chat.unread(channel) > 0, 'unread-indicator')}
          </div>
        </li>
      );
    }

    const user = chatUser(item.id);
    const selected = this.members.includes(item.id);

    return (
      <li
        key={`u${item.id}`}
        className={classList('chat-message-creator__list-item', { '-highlighted': highlighted, '-selected': selected })}
        onclick={(e: MouseEvent) => (this.group || e.shiftKey ? this.toggleMember(item.id) : this.open([item.id]))}
        onmouseenter={() => (this.index = index)}
      >
        <div className="chat-message-creator__chatable -user">
          {ChatUserAvatar(item.id, { interactive: false })}
          <span className="chat-user-display-name__username -first">{user?.username()}</span>
          {user?.displayName() !== user?.username() && <span className="chat-user-display-name__name">{user?.displayName()}</span>}
          {selected && <Icon name="fas fa-check" />}
        </div>
        {!this.group && highlighted && (
          <span className="chat-message-creator__shortcut">{ct('new_message_modal.add_user_long', { username: user?.username() || '' })}</span>
        )}
      </li>
    );
  }

  private keydown(e: KeyboardEvent): void {
    const items = this.items();

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.index = (this.index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[this.index];

      if (!item) return;
      if (item.type === 'group') this.group = true;
      else if (item.type === 'channel') go({ name: 'channel', channelId: item.channel.id }, this.attrs.inDrawer);
      else if (this.group || e.shiftKey) this.toggleMember(item.id);
      else this.open([item.id]);
    } else if (e.key === 'Backspace' && !this.query && this.members.length) {
      this.members.pop();
    }
  }

  private toggleMember(id: number): void {
    const max = (caps().dmMaxUsers || 20) - 1;

    if (this.members.includes(id)) this.members = this.members.filter((m) => m !== id);
    else if (this.members.length < max) this.members.push(id);

    this.group = true;
    this.query = '';
    this.search();
  }

  private search(): void {
    const request = ++this.request;
    const query = this.query.trim().replace(/^[#@]/, '');

    if (this.query.trim().startsWith('#') || !caps().canDirectMessage) {
      this.users = [];
      return;
    }

    setTimeout(() => {
      if (request !== this.request) return;

      chatRequest('GET', '/users', undefined, { q: query }, { errorHandler: () => {} })
        .then((result: any) => {
          if (request !== this.request) return;

          pushUsers(result.users);
          this.users = result.userIds;
          m.redraw();
        })
        .catch(() => {});
    }, 150);
  }

  private async open(userIds: number[], name?: string): Promise<void> {
    this.busy = true;

    try {
      const result = await chatRequest('POST', '/direct-messages', { userIds, name: name || undefined });
      pushUsers(result.users);
      const channel = chat.putChannel(result.channel);

      go({ name: 'channel', channelId: channel.id }, this.attrs.inDrawer);
    } finally {
      this.busy = false;
      m.redraw();
    }
  }

  private async addMembers(): Promise<void> {
    this.busy = true;

    try {
      await chatRequest('POST', `/channels/${this.attrs.addTo!.id}/members`, { userIds: this.members });
      await chat.fetchChannel(this.attrs.addTo!.id);
      app.alerts.show({ type: 'success' }, ct('mention_warning.invitations_sent', { count: this.members.length }));
      this.members = [];
      this.attrs.onadded?.();
    } finally {
      this.busy = false;
      m.redraw();
    }
  }
}
