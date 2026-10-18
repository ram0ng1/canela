/*
 * As seções "Canais" e "Mensagens diretas" da barra lateral, como as do
 * Discourse (o modo combinado: o chat embaixo das categorias e etiquetas).
 *
 * - Canais: o ícone na cor da tag, o nome e, à direita, o número verde das
 *   menções ou o pontinho das não lidas; o lápis do cabeçalho leva a
 *   "Navegar por todos os canais".
 * - Mensagens diretas: o avatar, os nomes e o "+" de nova conversa; o "x" de
 *   fechar aparece ao passar o mouse.
 *
 * Os links abrem a conversa na gaveta, ou na página cheia para quem a prefere
 * — o mesmo que o ícone do cabeçalho faria.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../../components/CanelaSidebar';
import chat, { routeUrl } from './ChatStore';
import { ChannelIcon, UnreadIndicator } from './components/bits';
import { caps, channelTitle, chatOn, chatRequest, ct } from './utils';
import type { ChatChannel, ChatRoute } from './types';

/** Abre na gaveta ou na página cheia, conforme o leitor usa o chat. */
export function openChat(route: ChatRoute): void {
  if (chat.isFullPage() || chat.prefersFullPage || app.screen() === 'phone') {
    m.route.set(routeUrl(route, chat));

    // No celular a barra está dentro da gaveta do menu: ela fecha ao navegar.
    if (app.screen() === 'phone') app.drawer?.hide?.();
  } else {
    chat.openDrawer(route);
  }
}

interface ChatSidebarSectionAttrs extends ComponentAttrs {
  name: string;
  title: string;
  actionIcon: string;
  actionLabel: string;
  onaction: () => void;
}

/**
 * Seção recolhível com o botão de ação do cabeçalho. Igual à SidebarSection
 * do tema (mesmas classes e a mesma memória de recolhida), mas com o ícone
 * da ação escolhido — o "+" das MDs não é um lápis.
 */
class ChatSidebarSection extends Component<ChatSidebarSectionAttrs> {
  private collapsed = false;

  oninit(vnode: Mithril.Vnode<ChatSidebarSectionAttrs, this>) {
    super.oninit(vnode);

    try {
      this.collapsed = localStorage.getItem(`canela.sidebarSection.${this.attrs.name}`) === '1';
    } catch {
      this.collapsed = false;
    }
  }

  view(vnode: Mithril.Vnode<ChatSidebarSectionAttrs, this>): Mithril.Children {
    const { name, title, actionIcon, actionLabel, onaction } = this.attrs;
    const id = `canela-sidebar-section-${name}`;

    return (
      <section
        className={classList('CanelaSidebar-section', `CanelaSidebar-section--${name}`, 'CanelaChatSidebarSection', { collapsed: this.collapsed })}
      >
        <div className="CanelaSidebar-sectionHead">
          <button
            type="button"
            className="CanelaSidebar-sectionHeader"
            aria-expanded={this.collapsed ? 'false' : 'true'}
            aria-controls={id}
            onclick={() => this.toggle()}
          >
            <Icon name="fas fa-angle-down" className="CanelaSidebar-sectionCaret" />
            <span className="CanelaSidebar-sectionTitle">{title}</span>
          </button>
          <button
            type="button"
            className="CanelaSidebar-sectionEdit CanelaChatSidebarSection-action"
            aria-label={actionLabel}
            title={actionLabel}
            onclick={onaction}
          >
            <Icon name={actionIcon} />
          </button>
        </div>
        {!this.collapsed && (
          <ul className="CanelaSidebar-sectionContent" id={id}>
            {vnode.children}
          </ul>
        )}
      </section>
    );
  }

  private toggle(): void {
    this.collapsed = !this.collapsed;

    try {
      localStorage.setItem(`canela.sidebarSection.${this.attrs.name}`, this.collapsed ? '1' : '0');
    } catch {
      // Vale só até recarregar.
    }
  }
}

function channelLink(channel: ChatChannel): Mithril.Children {
  const active = chat.isFullPage() && chat.activeChannelId === channel.id;
  const urgent = chat.urgent(channel);
  const unread = chat.unread(channel) > 0;

  return (
    <li key={channel.id} className={classList('CanelaChatSidebarItem', { active })}>
      <a
        className={classList('CanelaChatSidebarLink', `--${channel.type}`, {
          active,
          muted: channel.membership?.muted,
          'has-unread': unread || urgent > 0,
        })}
        href={routeUrl({ name: 'channel', channelId: channel.id }, chat)}
        active={String(active)}
        title={channel.description || channelTitle(channel)}
        onclick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.button !== 0) return;
          e.preventDefault();
          openChat({ name: 'channel', channelId: channel.id });
        }}
      >
        <span className="CanelaChatSidebarLink-prefix">{ChannelIcon(channel)}</span>
        <span className="Button-label">{channelTitle(channel)}</span>
        {channel.membership?.starred && <Icon name="fas fa-star" className="CanelaChatSidebarLink-starred" />}
        <span className="CanelaChatSidebarLink-suffix">{UnreadIndicator(urgent, unread)}</span>
        {channel.type === 'direct' && (
          // Um <span>, e não um <button>: botão dentro de link não é HTML válido.
          <span
            role="button"
            tabindex="0"
            className="CanelaChatSidebarLink-close"
            aria-label={ct('direct_messages.close')}
            title={ct('direct_messages.close')}
            onclick={(e: MouseEvent) => {
              e.preventDefault();
              e.stopPropagation();
              closeDm(channel);
            }}
          >
            <Icon name="fas fa-xmark" />
          </span>
        )}
      </a>
    </li>
  );
}

async function closeDm(channel: ChatChannel): Promise<void> {
  if (channel.membership) channel.membership.following = false;
  m.redraw();

  try {
    await chatRequest('DELETE', `/channels/${channel.id}/membership`);
  } catch {
    if (channel.membership) channel.membership.following = true;
    m.redraw();
  }
}

export default function installChatSidebar(): void {
  extend(CanelaSidebar.prototype, 'sectionItems', function (items: ItemList<Mithril.Children>) {
    if (!chatOn() || caps().sidebar === false) return;

    chat.start();

    const channels = chat.publicChannels();

    items.add(
      'chatChannels',
      <ChatSidebarSection
        name="chat-channels"
        title={ct('chat_channels')}
        actionIcon="fas fa-pencil"
        actionLabel={ct('browse_all_channels')}
        onaction={() => openChat({ name: 'browse' })}
      >
        {channels.length ? (
          channels.map(channelLink)
        ) : (
          <li className="CanelaChatSidebarItem --empty">
            <a
              className="CanelaChatSidebarLink --browse"
              href={routeUrl({ name: 'browse' }, chat)}
              onclick={(e: MouseEvent) => {
                e.preventDefault();
                openChat({ name: 'browse' });
              }}
            >
              <Icon name="fas fa-list" className="CanelaSidebar-linkIcon" />
              <span className="Button-label">{ct('browse_all_channels')}</span>
            </a>
          </li>
        )}
      </ChatSidebarSection>,
      60
    );

    if (caps().canDirectMessage) {
      const direct = chat.directChannels();

      items.add(
        'chatDirectMessages',
        <ChatSidebarSection
          name="chat-dms"
          title={ct('direct_messages.sidebar_title')}
          actionIcon="fas fa-plus"
          actionLabel={ct('direct_messages.new_group')}
          onaction={() => openChat({ name: 'new-message' })}
        >
          {direct.length ? (
            direct.map(channelLink)
          ) : (
            <li className="CanelaChatSidebarItem --empty">
              <a
                className="CanelaChatSidebarLink --new"
                href={routeUrl({ name: 'new-message' }, chat)}
                onclick={(e: MouseEvent) => {
                  e.preventDefault();
                  openChat({ name: 'new-message' });
                }}
              >
                <Icon name="fas fa-plus" className="CanelaSidebar-linkIcon" />
                <span className="Button-label">{ct('no_direct_message_channels_cta')}</span>
              </a>
            </li>
          )}
        </ChatSidebarSection>,
        55
      );
    }
  });
}
