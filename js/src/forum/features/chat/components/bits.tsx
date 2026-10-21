/*
 * Peças pequenas do chat: o avatar do usuário,
 * o ícone e o título do canal, o indicador de não lidas e a barra de
 * navegação (c-navbar) com os botões da gaveta.
 */
import app from 'flarum/forum/app';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { openUserCard } from '../../../topic/components/UserCardPopover';
import chat from '../ChatStore';
import { channelTitle, chatUser, ct, displayName, emoji, isSelfDm, otherParticipants } from '../utils';
import type { ChatChannel } from '../types';

/** Avatar com o cartão de usuário no clique. */
export function ChatUserAvatar(userId: number | null | undefined, options: { interactive?: boolean; size?: string } = {}): Mithril.Children {
  const user = chatUser(userId);

  return (
    <div className={classList('chat-user-avatar', options.size && `-${options.size}`)}>
      <span className="chat-user-avatar__container" onclick={options.interactive !== false && user ? (e: MouseEvent) => cardFor(user, e) : undefined}>
        <Avatar user={user} className="avatar" />
      </span>
    </div>
  );
}

export function cardFor(user: User, event: MouseEvent): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey) return;

  event.preventDefault();
  event.stopPropagation();
  openUserCard(user, event.currentTarget as HTMLElement);
}

/** O ícone do canal: o emoji, o ícone da tag na cor dela, ou os avatares da MD. */
export function ChannelIcon(channel: ChatChannel): Mithril.Children {
  if (channel.type === 'direct') {
    const others = otherParticipants(channel);

    if (channel.isGroup && others.length > 1) {
      return (
        <div className="chat-channel-icon --users-count">
          <span>{channel.participantIds.length}</span>
        </div>
      );
    }

    return <div className="chat-channel-icon --avatar">{ChatUserAvatar(others[0], { interactive: false })}</div>;
  }

  if (channel.emoji) return <div className="chat-channel-icon --emoji">{emoji(channel.emoji)}</div>;

  return (
    <div className="chat-channel-icon --icon" style={{ color: channel.tag?.color || undefined }}>
      <Icon name={channel.tag?.icon || 'fas fa-comment'} />
    </div>
  );
}

export function ChannelName(channel: ChatChannel, unreadIndicator = false): Mithril.Children {
  const urgent = chat.urgent(channel);
  const unread = chat.unread(channel);

  return (
    <div className="chat-channel-name">
      <span className="chat-channel-name__label">
        {channelTitle(channel)}
        {isSelfDm(channel) && <span className="chat-channel-name__you"> ({ct('you')})</span>}
      </span>
      {unreadIndicator && (urgent > 0 || unread > 0) && UnreadIndicator(urgent, unread > 0)}
    </div>
  );
}

export function ChannelTitle(channel: ChatChannel): Mithril.Children {
  return (
    <div className={classList('chat-channel-title', channel.type === 'direct' ? 'is-dm' : 'is-category')}>
      {ChannelIcon(channel)}
      {ChannelName(channel)}
    </div>
  );
}

/** O ponto azul (há não lidas) ou o número verde (menções e MDs). */
export function UnreadIndicator(urgent: number, unread: boolean, className = 'chat-channel-unread-indicator'): Mithril.Children {
  if (urgent > 0) {
    return (
      <div className={`${className} -urgent`}>
        <div className={`${className}__number`}>{urgent > 99 ? '99+' : urgent}</div>
      </div>
    );
  }

  return unread ? <div className={className} /> : null;
}

export interface NavbarButton {
  key: string;
  icon: string;
  title: string;
  onclick: (e: MouseEvent) => void;
  className?: string;
  active?: boolean;
  indicator?: Mithril.Children;
}

/**
 * A barra de cima da gaveta e da página cheia (c-navbar): voltar, o título e
 * os botões. Na gaveta, clicar no fundo da barra recolhe/expande, como lá.
 */
export function Navbar(attrs: {
  title: Mithril.Children;
  back?: () => void;
  actions: NavbarButton[];
  onclick?: () => void;
  subTitle?: Mithril.Children;
}): Mithril.Children {
  return (
    <div className={classList('c-navbar-container', { '-clickable': !!attrs.onclick })} onclick={attrs.onclick}>
      <nav className="c-navbar">
        {attrs.back && (
          <button
            type="button"
            className="Button Button--icon Button--flat c-navbar__back-button"
            aria-label={ct('channel_info.back_to_channel')}
            title={ct('channel_info.back_to_channel')}
            onclick={(e: MouseEvent) => {
              e.stopPropagation();
              attrs.back!();
            }}
          >
            <Icon name="fas fa-chevron-left" />
          </button>
        )}
        <div className="c-navbar__title">
          <span className="c-navbar__title-text">{attrs.title}</span>
          {attrs.subTitle && <div className="c-navbar__sub-title">{attrs.subTitle}</div>}
        </div>
        <ul className="c-navbar__actions">
          {attrs.actions.map((action) => (
            <li key={action.key}>
              <Tooltip text={action.title}>
                <button
                  type="button"
                  className={classList('Button Button--icon Button--flat c-navbar__button', action.className, { active: action.active })}
                  aria-label={action.title}
                  onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    action.onclick(e);
                  }}
                >
                  <Icon name={action.icon} />
                  {action.indicator}
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** Os três botões da gaveta: recolher/expandir, tela cheia e fechar. */
export function drawerButtons(inDrawer: boolean): NavbarButton[] {
  if (!inDrawer) {
    return [];
  }

  return [
    {
      key: 'toggle',
      icon: chat.drawer.expanded ? 'fas fa-chevron-down' : 'fas fa-chevron-up',
      title: chat.drawer.expanded ? ct('collapse') : ct('expand'),
      className: 'c-navbar__toggle-drawer-button',
      onclick: () => chat.toggleExpand(),
    },
    {
      key: 'full',
      icon: 'fas fa-up-right-and-down-left-from-center',
      title: ct('open_full_page'),
      className: 'c-navbar__full-page-button',
      onclick: () => chat.openFullPage(),
    },
    {
      key: 'close',
      icon: 'fas fa-xmark',
      title: ct('close'),
      className: 'c-navbar__close-drawer-button',
      onclick: () => chat.closeDrawer(),
    },
  ];
}

export function userNames(ids: number[]): string {
  return ids.map((id) => displayName(id)).join(', ');
}

export function isPhone(): boolean {
  return app.screen() === 'phone';
}
