/*
 * "Informações do canal" (c-channel-info do Discourse), com as abas Membros e
 * Configurações:
 *
 * - Configurações: nome, slug e descrição; as preferências pessoais
 *   (favoritar, silenciar, notificações); a parte da administração (fios,
 *   @all/@here, entrada automática, fechar, arquivar, excluir); e "Sair".
 * - Membros: a lista com o filtro e "Adicionar membro".
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Switch from 'flarum/common/components/Switch';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat from '../ChatStore';
import { ChatUserAvatar } from './bits';
import { go } from './ChannelsList';
import MessageCreator from './MessageCreator';
import { DeleteChannelModal } from './modals';
import { caps, channelTitle, chatRequest, chatUser, ct, pushUsers } from '../utils';
import type { ChatChannel, NotificationLevel } from '../types';

export interface ChannelInfoAttrs extends ComponentAttrs {
  channel: ChatChannel;
  tab: 'settings' | 'members';
  inDrawer: boolean;
}

export default class ChannelInfo extends Component<ChannelInfoAttrs> {
  view(): Mithril.Children {
    const { channel, tab, inDrawer } = this.attrs;
    const members = channel.type === 'direct' ? channel.participantIds.length : channel.userCount;

    return (
      <div className="c-channel-info">
        <nav className="c-channel-info__nav">
          <ul className="nav-pills">
            <li className={classList({ active: tab === 'members' })}>
              <a href="#" className={classList({ active: tab === 'members' })} onclick={(e: MouseEvent) => this.tab(e, 'members')}>
                {ct('channel_info.tabs.members')}
                <span className="c-channel-info__member-count">({members})</span>
              </a>
            </li>
            <li className={classList({ active: tab === 'settings' })}>
              <a href="#" className={classList({ active: tab === 'settings' })} onclick={(e: MouseEvent) => this.tab(e, 'settings')}>
                {ct('channel_info.tabs.settings')}
              </a>
            </li>
          </ul>
        </nav>
        {tab === 'members' ? <ChannelMembers channel={channel} inDrawer={inDrawer} /> : <ChannelSettings channel={channel} inDrawer={inDrawer} />}
      </div>
    );
  }

  private tab(e: MouseEvent, tab: 'settings' | 'members'): void {
    e.preventDefault();
    go({ name: 'channel-info', channelId: this.attrs.channel.id, tab }, this.attrs.inDrawer);
  }
}

interface SectionAttrs extends ComponentAttrs {
  channel: ChatChannel;
  inDrawer: boolean;
}

function Row(label: Mithril.Children, action?: Mithril.Children, description?: Mithril.Children, className = ''): Mithril.Children {
  return (
    <div className={classList('chat-form__row', className)}>
      <div className="chat-form__row-content">
        <span className="chat-form__row-label">{label}</span>
        {action && <span className="chat-form__row-action">{action}</span>}
      </div>
      {description && <div className="chat-form__row-description">{description}</div>}
    </div>
  );
}

function Section(title: Mithril.Children | null, children: Mithril.Children, className = ''): Mithril.Children {
  return (
    <div className={classList('chat-form__section', className)}>
      {title && <div className="chat-form__section-title">{title}</div>}
      <div className="chat-form__section-content">{children}</div>
    </div>
  );
}

class ChannelSettings extends Component<SectionAttrs> {
  private editing: 'name' | 'description' | null = null;
  private draft = '';
  private draftSlug = '';
  private saving = false;

  view(): Mithril.Children {
    const channel = this.attrs.channel;
    const membership = channel.membership;
    const isPublic = channel.type === 'public';

    return (
      <div className="c-channel-settings">
        <div className="chat-form">
          {Section(
            ct('settings.info_title'),
            [
              this.editing === 'name'
                ? this.editRow('name')
                : Row(
                    <>
                      <strong>{ct('about_view.name')}</strong>
                      <div>{channelTitle(channel)}</div>
                    </>,
                    channel.canEdit && this.editButton('name')
                  ),
              isPublic &&
                this.editing !== 'name' &&
                Row(
                  <>
                    {/* eslint-disable-next-line i18n/no-hardcoded-text -- "Slug" é o termo técnico, igual ao do Discourse em todo idioma */}
                    <strong>Slug</strong>
                    <div className="c-channel-settings__slug">{channel.slug}</div>
                  </>
                ),
              this.editing === 'description'
                ? this.editRow('description')
                : (isPublic || channel.description) &&
                  Row(
                    <>
                      <strong>{ct('about_view.description')}</strong>
                      <div>{channel.description || '-'}</div>
                    </>,
                    channel.canEdit && isPublic && this.editButton('description')
                  ),
              channel.tag &&
                Row(
                  <>
                    <strong>{ct('about_view.associated_category')}</strong>
                    <div>{channel.tag.name}</div>
                  </>
                ),
              this.retention(),
            ],
            '--info'
          )}

          {membership?.following &&
            Section(ct('settings.settings_title'), [
              Row(
                ct('channel_settings.star_channel'),
                <Switch state={membership.starred} onchange={(value: boolean) => this.membership({ starred: value })} />
              ),
              Row(ct('settings.mute'), <Switch state={membership.muted} onchange={(value: boolean) => this.membership({ muted: value })} />),
              !membership.muted &&
                Row(
                  ct('settings.notification_level'),
                  <select
                    className="FormControl"
                    value={membership.notificationLevel}
                    onchange={(e: Event) => this.membership({ notificationLevel: (e.target as HTMLSelectElement).value as NotificationLevel })}
                  >
                    {(['always', 'mention', 'never'] as NotificationLevel[]).map((level) => (
                      <option value={level}>{ct(`notification_levels.${level}`)}</option>
                    ))}
                  </select>
                ),
            ])}

          {channel.canModerate && isPublic && this.adminSection()}

          {membership?.following && this.leaveSection()}
        </div>
      </div>
    );
  }

  private retention(): Mithril.Children {
    const days = this.attrs.channel.type === 'direct' ? caps().dmRetentionDays : caps().retentionDays;

    return Row(
      <strong>{ct('settings.history_label')}</strong>,
      undefined,
      <span className="chat-retention-reminder-text">
        {days ? ct('retention_reminders.long', { count: days }) : ct('retention_reminders.indefinitely_long_plain')}
      </span>
    );
  }

  private editButton(field: 'name' | 'description'): Mithril.Children {
    return (
      <Button
        className="Button Button--flat chat-form__btn"
        icon="fas fa-pencil"
        onclick={() => {
          this.editing = field;
          this.draft = (field === 'name' ? this.attrs.channel.name : this.attrs.channel.description) || '';
          this.draftSlug = this.attrs.channel.slug;
        }}
      >
        {ct('channel_settings.edit')}
      </Button>
    );
  }

  private editRow(field: 'name' | 'description'): Mithril.Children {
    const isPublic = this.attrs.channel.type === 'public';

    return (
      <div className="chat-form__row -editing">
        {field === 'name' ? (
          <>
            <input
              className="FormControl"
              maxlength={100}
              placeholder={ct('channel_edit_name_slug_modal.input_placeholder')}
              value={this.draft}
              oninput={(e: InputEvent) => (this.draft = (e.target as HTMLInputElement).value)}
            />
            {isPublic && (
              <>
                <input
                  className="FormControl"
                  maxlength={100}
                  value={this.draftSlug}
                  oninput={(e: InputEvent) => (this.draftSlug = (e.target as HTMLInputElement).value)}
                />
                <p className="helpText">{ct('channel_edit_name_slug_modal.slug_description')}</p>
              </>
            )}
          </>
        ) : (
          <>
            <p className="chat-modal-edit-channel-description__description">{ct('channel_edit_description_modal.description')}</p>
            <textarea
              className="FormControl"
              rows={4}
              maxlength={500}
              placeholder={ct('channel_edit_description_modal.input_placeholder')}
              value={this.draft}
              oninput={(e: InputEvent) => (this.draft = (e.target as HTMLTextAreaElement).value)}
            />
          </>
        )}
        <div className="chat-form__row-buttons">
          <Button className="Button Button--primary" loading={this.saving} onclick={() => this.save(field)}>
            {ct('save')}
          </Button>
          <Button className="Button" onclick={() => (this.editing = null)}>
            {ct('cancel')}
          </Button>
        </div>
      </div>
    );
  }

  private async save(field: 'name' | 'description'): Promise<void> {
    this.saving = true;

    try {
      await this.update(
        field === 'name'
          ? { name: this.draft, ...(this.attrs.channel.type === 'public' ? { slug: this.draftSlug } : {}) }
          : { description: this.draft }
      );
      this.editing = null;
    } finally {
      this.saving = false;
      m.redraw();
    }
  }

  private async update(attributes: Record<string, unknown>): Promise<void> {
    const result = await chatRequest('PATCH', `/channels/${this.attrs.channel.id}`, attributes);

    pushUsers(result.users);
    chat.putChannel(result.channel);
    m.redraw();
  }

  private async membership(attributes: Record<string, unknown>): Promise<void> {
    const result = await chatRequest('PATCH', `/channels/${this.attrs.channel.id}/membership`, attributes);

    pushUsers(result.users);
    chat.putChannel(result.channel);
    app.alerts.show({ type: 'success' }, ct('settings.saved'));
    m.redraw();
  }

  private adminSection(): Mithril.Children {
    const channel = this.attrs.channel;

    return Section(ct('settings.admin_title'), [
      caps().threads &&
        Row(
          ct('settings.channel_threading_label'),
          <Switch state={channel.threadingEnabled} onchange={(value: boolean) => this.update({ threadingEnabled: value })} />,
          ct('settings.channel_threading_description')
        ),
      Row(
        ct('settings.channel_wide_mentions_label'),
        <Switch state={channel.allowChannelWideMentions} onchange={(value: boolean) => this.update({ allowChannelWideMentions: value })} />,
        ct('settings.channel_wide_mentions_description', { channel: channel.name })
      ),
      Row(
        ct('settings.auto_join_users_label'),
        <Switch state={channel.autoJoin} onchange={(value: boolean) => this.update({ autoJoin: value })} />,
        channel.tag ? ct('settings.auto_join_users_info', { category: channel.tag.name }) : ct('settings.auto_join_users_info_no_category')
      ),
      channel.status !== 'archived' &&
        Row(
          channel.status === 'closed' ? ct('channel_settings.open_channel') : ct('channel_settings.close_channel'),
          <Button
            className="Button"
            icon={channel.status === 'closed' ? 'fas fa-lock-open' : 'fas fa-lock'}
            disabled={channel.status === 'read_only'}
            onclick={() => this.update({ status: channel.status === 'closed' ? 'open' : 'closed' })}
          >
            {channel.status === 'closed' ? ct('channel_settings.open_channel') : ct('channel_settings.close_channel')}
          </Button>,
          channel.status === 'closed' ? ct('channel_open.instructions') : ct('channel_close.instructions')
        ),
      channel.status !== 'archived' &&
        Row(
          ct('channel_settings.archive_channel'),
          <Button
            className="Button"
            icon="fas fa-box-archive"
            onclick={() => confirm(ct('channel_archive.confirm', { channelTitle: channel.name })) && this.update({ status: 'archived' })}
          >
            {ct('channel_settings.archive_channel')}
          </Button>,
          ct('channel_archive.instructions_plain')
        ),
      Row(
        ct('channel_settings.delete_channel'),
        <Button className="Button Button--danger" icon="far fa-trash-can" onclick={() => app.modal.show(DeleteChannelModal, { channel })}>
          {ct('channel_settings.delete_channel')}
        </Button>
      ),
    ]);
  }

  private leaveSection(): Mithril.Children {
    const channel = this.attrs.channel;
    const group = channel.type === 'direct' && channel.isGroup;

    return Section(
      null,
      [
        <Button className="Button Button--danger chat-form__btn -leave" icon="fas fa-right-from-bracket" onclick={() => this.leave()}>
          {ct('channel_settings.leave_channel')}
        </Button>,
        group && (
          <p className="c-channel-settings__leave-info">
            <Icon name="fas fa-circle-exclamation" /> {ct('channel_settings.leave_groupchat_info')}
          </p>
        ),
      ],
      '--leave-channel'
    );
  }

  private async leave(): Promise<void> {
    const channel = this.attrs.channel;

    await chatRequest('DELETE', `/channels/${channel.id}/membership`);

    if (channel.membership) channel.membership.following = false;
    if (channel.type === 'direct' && channel.isGroup) chat.channels.delete(channel.id);

    chat.refreshSoon();
    go({ name: channel.type === 'direct' ? 'direct-messages' : 'channels' }, this.attrs.inDrawer);
  }
}

class ChannelMembers extends Component<SectionAttrs> {
  private ids: number[] | null = null;
  private query = '';
  private hasMore = false;
  private adding = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  oninit(vnode: Mithril.Vnode<SectionAttrs, this>) {
    super.oninit(vnode);
    this.load();
  }

  private async load(offset = 0): Promise<void> {
    const result = await chatRequest('GET', `/channels/${this.attrs.channel.id}/members`, undefined, { q: this.query, offset });

    pushUsers(result.users);
    this.ids = offset ? [...(this.ids || []), ...result.memberIds] : result.memberIds;
    this.hasMore = result.hasMore;
    m.redraw();
  }

  view(): Mithril.Children {
    const channel = this.attrs.channel;

    if (this.adding) {
      return (
        <div className="c-channel-members">
          <MessageCreator
            inDrawer={this.attrs.inDrawer}
            addTo={channel}
            onadded={() => {
              this.adding = false;
              this.load();
            }}
          />
          <Button className="Button Button--flat" icon="fas fa-chevron-left" onclick={() => (this.adding = false)}>
            {ct('members_view.back_to_settings')}
          </Button>
        </div>
      );
    }

    return (
      <div className="c-channel-members">
        <div className="c-channel-members__filter">
          <input
            className="FormControl"
            type="search"
            placeholder={ct('members_view.filter_placeholder')}
            value={this.query}
            oninput={(e: InputEvent) => {
              this.query = (e.target as HTMLInputElement).value;
              if (this.timer) clearTimeout(this.timer);
              this.timer = setTimeout(() => this.load(), 250);
            }}
          />
        </div>
        <ul className="c-channel-members__list">
          {channel.canAddMembers && (
            <li className="c-channel-members__list-item -add-member" role="button" onclick={() => (this.adding = true)}>
              <Icon name="fas fa-user-plus" />
              <span>{ct('members_view.add_member')}</span>
            </li>
          )}
          {!this.ids && <LoadingIndicator />}
          {this.ids && !this.ids.length && (
            <li className="c-channel-members__list-item -no-results">
              {this.query ? ct('channel.no_memberships_found') : ct('channel.no_memberships')}
            </li>
          )}
          {(this.ids || []).map((id) => {
            const user = chatUser(id);

            return (
              <li
                key={id}
                className="c-channel-members__list-item -member"
                onclick={() => user && m.route.set(app.route('user', { username: user.slug() }))}
              >
                {ChatUserAvatar(id)}
                <span className="chat-user-display-name">
                  <span className="-first">{user?.username()}</span>
                  {user && user.displayName() !== user.username() && <span>{user.displayName()}</span>}
                </span>
              </li>
            );
          })}
        </ul>
        {this.hasMore && (
          <Button className="Button" onclick={() => this.load(this.ids?.length || 0)}>
            {ct('load_more')}
          </Button>
        )}
      </div>
    );
  }
}
