/*
 * A página inicial do chat (/chat sem canal): em vez de abrir sozinha a
 * última conversa, uma lista com mais opções, na moldura do chat do tema.
 *
 * - No computador, as abas no topo (Canais, Mensagens diretas, Meus tópicos,
 *   Pesquisar e, para moderadores, Salvos/Denúncias); no celular, as abas de
 *   baixo (c-footer).
 * - Canais: "Continuar em #canal" (a última conversa) no topo, os botões
 *   "Explorar canais" e "Novo canal" e cada canal com o ícone, o nome, a
 *   descrição curta, a hora da última atividade e o indicador de não lidas.
 * - Mensagens diretas: o avatar, a última mensagem e a hora, e o "Nova
 *   mensagem" (o gancho `newMessage` dos recursos, em ./features).
 * - Meus tópicos, Pesquisar, Salvos e Denúncias são as telas do ramon/chat.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Button from 'flarum/common/components/Button';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { formatWith } from '../../utils/dates';
import { t } from '../../utils/settings';
import { channelUrl, chatState, openChannel, ramonChannelIcon, ramonModule, type RamonChannel } from './bridge';
import { safely, sidebarHooks } from './hooks';
import { ChatFooter, Navbar, UnreadIndicator, ct, toDrawer, type NavbarAction } from './ui';

export type LobbyTab = 'channels' | 'dms';

/** A conversa a continuar: a última aberta antes de chegar à lista. */
let continueId: number | null = null;

export function rememberContinue(id: number | null): void {
  if (id !== null) continueId = id;
}

function rt(key: string, params: Record<string, unknown> = {}): string {
  return app.translator.trans(`ramon-chat.forum.${key}`, params, true) as string;
}

function tr(key: string, params: Record<string, unknown> = {}): string {
  return t(`thirdparty.ramon_chat.${key}`, params);
}

function phone(): boolean {
  return window.innerWidth < 768;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** "14:35" hoje, "ontem"/"13 out" antes — a hora da última atividade. */
function activity(date: Date | null | undefined): string {
  if (!date) return '';

  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (days === 0) return formatWith(date, { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return ct('chat_message_separator.yesterday');

  return formatWith(date, { day: 'numeric', month: 'short' }).replace(/\./g, '').replace(/\sde\s/g, ' ');
}

/** O texto da última mensagem, sem marcação, com o autor nas MDs em grupo. */
function lastMessageText(channel: RamonChannel): string {
  const last: any = safely(() => (channel as any).lastMessage?.(), null);

  if (!last) return '';

  const html = String(safely(() => last.contentHtml?.() || last.content?.() || '', ''));
  const div = document.createElement('div');
  div.innerHTML = html;

  const text = (div.textContent || '').replace(/\s+/g, ' ').trim();
  const author = safely(() => last.user?.()?.displayName?.() || '', '');
  const mine = safely(() => last.user?.() === app.session.user, false);

  if (!text) return '';

  return mine ? `${ct('you')}: ${text}` : channel.isDirect() && (channel.others() || []).length > 1 && author ? `${author}: ${text}` : text;
}

function sorted(channels: RamonChannel[], section: 'channels' | 'direct'): RamonChannel[] {
  const sort = sidebarHooks.sortChannels;

  return sort ? safely(() => sort(channels.slice(0), section), channels) : channels;
}

function lastAt(channel: RamonChannel): Date | null {
  return safely(() => (channel as any).lastMessageAt?.() || null, null);
}

/** Uma linha da lista: ícone, nome (+ selo), texto de apoio, hora e indicador. */
function row(channel: RamonChannel, subtitle: string): Mithril.Children {
  const id = Number(channel.id());
  const direct = channel.isDirect();
  const mentions = channel.unreadMentionsCount() ?? 0;
  const unread = channel.hasUnread();
  const urgent = direct ? (channel.isMuted() ? 0 : channel.unreadCount() ?? 0) : mentions;

  return (
    <li key={id} className="CanelaRamonChatLobby-item">
      <a
        className={classList('CanelaRamonChatLobby-row', { 'has-unread': unread || urgent > 0, muted: channel.isMuted() })}
        href={channelUrl(id)}
        onclick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          openChannel(id);
        }}
      >
        <span className={classList('CanelaRamonChatLobby-icon', { '--avatar': direct })}>{ramonChannelIcon(channel, 'CanelaRamonChatLobby-glyph')}</span>
        <span className="CanelaRamonChatLobby-main">
          <span className="CanelaRamonChatLobby-name">
            <span className="CanelaRamonChatLobby-label">{channel.displayName()}</span>
            {channel.isPrivate() && !direct && <Icon name="fas fa-lock" className="CanelaRamonChatLobby-lock" />}
            {sidebarHooks.channelSuffix && safely(() => sidebarHooks.channelSuffix!(channel), null)}
          </span>
          {subtitle && <span className="CanelaRamonChatLobby-subtitle">{subtitle}</span>}
        </span>
        <span className="CanelaRamonChatLobby-meta">
          <span className="CanelaRamonChatLobby-time">{activity(lastAt(channel))}</span>
          {UnreadIndicator(urgent, unread)}
        </span>
      </a>
    </li>
  );
}

export interface ChatLobbyAttrs extends ComponentAttrs {
  tab: LobbyTab;
}

export default class ChatLobby extends Component<ChatLobbyAttrs> {
  oninit(vnode: Mithril.Vnode<ChatLobbyAttrs, this>) {
    super.oninit(vnode);

    const state = chatState();

    if (state && !state.channelsLoaded && !state.channelsLoading) state.loadChannels().then(() => m.redraw(), () => {});
  }

  view(): Mithril.Children {
    const { tab } = this.attrs;
    const onPhone = phone();

    const actions: NavbarAction[] = onPhone
      ? []
      : [
          {
            key: 'drawer',
            icon: 'fas fa-down-left-and-up-right-to-center',
            title: ct('close_full_page'),
            className: 'c-navbar__open-drawer-button',
            onclick: () => toDrawer(),
          },
        ];

    return (
      <div className="full-page-chat full-page-chat-sidebar-enabled CanelaRamonChatHome CanelaRamonChatLobby">
        <div id="main-chat-outlet" className="main-chat-outlet chat-view">
          <div className={`c-drawer-routes c-routes --${tab === 'dms' ? 'direct-messages' : 'channels'}`}>
            {Navbar({ title: ct('heading'), actions })}
            {!onPhone && <LobbyTabs current={tab} />}
            <div className="chat-drawer-content">
              <div className="CanelaRamonChatLobby-body">{tab === 'dms' ? this.directTab() : this.channelsTab()}</div>
            </div>
            {onPhone && <ChatFooter current={tab} />}
          </div>
        </div>
      </div>
    );
  }

  private channelsTab(): Mithril.Children {
    const state = chatState();
    const channels = sorted(state?.categoryChannels() || [], 'channels');
    const canCreate = !!app.forum.attribute<boolean>('canCreateChatChannel');
    const resume = continueId !== null ? state?.channels.find((c) => Number(c.id()) === continueId) || null : null;

    return [
      resume ? this.continueRow(resume) : null,
      <div className="CanelaRamonChatLobby-actions">
        <h2 className="CanelaRamonChatLobby-heading">{ct('chat_channels')}</h2>
        <Button className="Button" icon="fas fa-compass" onclick={() => m.route.set(app.route('chat.browse'))}>
          {rt('sidebar.browse_channels')}
        </Button>
        {canCreate && (
          <Button className="Button Button--primary" icon="fas fa-plus" onclick={() => createChannel()}>
            {rt('sidebar.new_channel')}
          </Button>
        )}
      </div>,
      channels.length ? (
        <ul className="CanelaRamonChatLobby-list">{channels.map((channel) => row(channel, channel.description() || ''))}</ul>
      ) : state?.channelsLoaded ? (
        <p className="CanelaRamonChatLobby-empty">{ct('no_public_channels')}</p>
      ) : null,
    ];
  }

  private directTab(): Mithril.Children {
    const state = chatState();
    const direct = sorted(state?.directChannels() || [], 'direct');
    const create = sidebarHooks.newMessage && app.forum.attribute<boolean>('canStartChatDirect') ? sidebarHooks.newMessage : null;

    return [
      <div className="CanelaRamonChatLobby-actions">
        <h2 className="CanelaRamonChatLobby-heading">{ct('direct_messages.sidebar_title')}</h2>
        {create && (
          <Button className="Button Button--primary" icon="fas fa-plus" onclick={() => create()}>
            {ct('direct_messages.new_group')}
          </Button>
        )}
      </div>,
      direct.length ? (
        <ul className="CanelaRamonChatLobby-list">{direct.map((channel) => row(channel, lastMessageText(channel)))}</ul>
      ) : state?.channelsLoaded ? (
        <p className="CanelaRamonChatLobby-empty">{ct('no_direct_message_channels')}</p>
      ) : null,
    ];
  }

  /** "Continuar em #canal": a última conversa, no topo, sem abrir sozinha. */
  private continueRow(channel: RamonChannel): Mithril.Children {
    const id = Number(channel.id());

    return (
      <a
        className="CanelaRamonChatLobby-continue"
        href={channelUrl(id)}
        onclick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          openChannel(id);
        }}
      >
        <span className="CanelaRamonChatLobby-continueLabel">{tr('continue_in')}</span>
        <span className="CanelaRamonChatLobby-icon">{ramonChannelIcon(channel, 'CanelaRamonChatLobby-glyph')}</span>
        <span className="CanelaRamonChatLobby-label">{channel.displayName()}</span>
        <Icon name="fas fa-arrow-right" className="CanelaRamonChatLobby-continueArrow" />
      </a>
    );
  }
}

/** Abre o formulário de canal do ramon/chat (o mesmo do "+" da lista dele). */
function createChannel(): void {
  const lazy = ramonModule<{ loadChannelFormModal?: () => Promise<any> }>('forum/utils/lazy');

  if (!lazy?.loadChannelFormModal) {
    m.route.set(app.route('chat.browse'));
    return;
  }

  app.modal.show(lazy.loadChannelFormModal, {
    onSaved: (channel: any) => {
      chatState()?.setActiveChannel(Number(channel.id()));
      m.route.set(app.route('chat.channel', { id: channel.id() }));
    },
  });
}

/** As abas do topo, no computador (Salvos e Denúncias só para quem modera). */
export class LobbyTabs extends Component<{ current: string }> {
  view(): Mithril.Children {
    const current = this.attrs.current;
    const tabs: [string, string, string, string][] = [
      ['channels', 'fas fa-comments', ct('channel_list.title'), `${app.route('chat.index')}?tab=channels`],
      ['dms', 'fas fa-users', ct('direct_messages.sidebar_title'), `${app.route('chat.index')}?tab=dms`],
      ['threads', 'fas fa-list-ul', ct('my_threads.title'), app.route('chat.threads')],
      ['search', 'fas fa-magnifying-glass', ct('search.short_title'), app.route('chat.search')],
    ];

    if (app.forum.attribute<boolean>('canModerateChat')) {
      tabs.push(['bookmarks', 'far fa-bookmark', rt('sidebar.bookmarks'), app.route('chat.bookmarks')]);
      tabs.push(['flags', 'far fa-flag', rt('sidebar.flags'), app.route('chat.flags')]);
    }

    return (
      <nav className="CanelaRamonChatLobby-tabs">
        <ul>
          {tabs.map(([name, icon, label, href]) => (
            <li key={name}>
              <a
                className={classList('CanelaRamonChatLobby-tab', { active: current === name })}
                href={href}
                onclick={(e: MouseEvent) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  m.route.set(href);
                }}
              >
                <Icon name={icon} />
                <span>{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
}
