/*
 * As telas de lista do chat interno do tema (features/chat), refeitas sobre o
 * estado do ramon/chat: a barra de cima (c-navbar), as listas de canais e de
 * MDs (chat-channel-row), o "x" que fecha a MD e as abas de baixo (c-footer:
 * Canais, MDs, Meus tópicos, Pesquisar). As classes são as do Discourse, as
 * mesmas do features/chat — o Chat.less também compila com o ramon/chat —,
 * então as telas saem idênticas às do chat do tema.
 *
 * A navegação é a do ramon/chat: na página cheia, as rotas dele (com
 * `?tab=channels|dms` na lista); na gaveta, uma aba guardada aqui.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Tooltip from 'flarum/common/components/Tooltip';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { t } from '../../utils/settings';
import { formatWith } from '../../utils/dates';
import { canUseChat, channelUrl, chatState, leaveDirect, openChannel, ramonChannelIcon, type RamonChannel } from './bridge';
import { safely, sidebarHooks } from './hooks';

export type ChatTab = 'channels' | 'dms' | 'threads' | 'search';

/** Tradução do chat do tema (`ramon-canela.forum.chat.*`): os rótulos são os mesmos das telas internas. */
export function ct(key: string, params: Record<string, unknown> = {}): string {
  return t(`chat.${key}`, params);
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function shortTime(date: Date): string {
  const time = formatWith(date, { hour: '2-digit', minute: '2-digit' });

  return startOfDay(date) === startOfDay(new Date()) ? time : formatWith(date, { day: 'numeric', month: 'short' }).replace(/\./g, '').replace(/\sde\s/g, ' ');
}

/** O ponto (há não lidas) ou o número verde (menções e MDs), como o UnreadIndicator interno. */
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

export interface NavbarAction {
  key: string;
  icon: string;
  title: string;
  onclick: (e: MouseEvent) => void;
  className?: string;
}

/*
 * Os tooltips daqui moram no <body> (`container`): dentro da gaveta, que corta
 * o que passa da borda (overflow: hidden), eles ficavam pela metade e por
 * baixo da barra dela. Na gaveta, os da direita abrem para a esquerda, para
 * dentro da tela.
 */

/** A barra de cima (c-navbar): voltar, o título e os botões. */
export function Navbar(attrs: { title: Mithril.Children; back?: () => void; actions?: NavbarAction[]; onclick?: () => void }): Mithril.Children {
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
        </div>
        <ul className="c-navbar__actions">
          {(attrs.actions || []).map((action) => (
            <li key={action.key}>
              <Tooltip text={action.title} container="body">
                <button
                  type="button"
                  className={classList('Button Button--icon Button--flat c-navbar__button', action.className)}
                  aria-label={action.title}
                  onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    action.onclick(e);
                  }}
                >
                  <Icon name={action.icon} />
                </button>
              </Tooltip>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

/** O endereço de uma aba na página cheia. */
export function tabUrl(tab: ChatTab): string {
  if (tab === 'threads') return app.route('chat.threads');
  if (tab === 'search') return app.route('chat.search');

  return `${app.route('chat.index')}?tab=${tab}`;
}

/** As abas na página: a lista, MDs, Meus tópicos e Pesquisar. */
export function currentTab(): ChatTab | null {
  const route = String(app.current.get('routeName') || '');

  if (route === 'chat.threads') return 'threads';
  if (route === 'chat.search') return 'search';
  if (route !== 'chat.index') return null;

  return m.route.param('tab') === 'dms' ? 'dms' : 'channels';
}

function phone(): boolean {
  return window.innerWidth < 768;
}

/** Os títulos das listas (os do chat do tema). */
export function tabTitle(tab: ChatTab, inDrawer = false): string {
  if (inDrawer) return ct('heading');

  return {
    channels: ct('channel_list.title'),
    dms: ct('direct_messages.title'),
    threads: ct('my_threads.title'),
    search: ct('search.title'),
  }[tab];
}

export interface ChatFooterAttrs extends ComponentAttrs {
  current: ChatTab | null;
  /** Na gaveta, as abas da lista trocam aqui, sem sair da página. */
  onselect?: (tab: ChatTab) => void;
}

/** As abas de baixo (c-footer), com o ponto/número de cada uma. */
export class ChatFooter extends Component<ChatFooterAttrs> {
  view(): Mithril.Children {
    const { current, onselect } = this.attrs;
    const state = chatState();
    const channels = state?.categoryChannels() || [];
    const direct = state?.directChannels() || [];
    const publicUrgent = channels.reduce((n, c) => n + (c.unreadMentionsCount() ?? 0), 0);
    const publicUnread = channels.some((c) => c.hasUnread());
    const dmUrgent = direct.reduce((n, c) => n + (c.isMuted() ? 0 : c.unreadCount() ?? 0), 0);

    const tab = (name: ChatTab, icon: string, label: string, indicator: Mithril.Children) => (
      <button
        type="button"
        className={classList('Button Button--flat c-footer__item', { '--active': current === name })}
        id={`c-footer-${name === 'dms' ? 'direct-messages' : name}`}
        aria-label={label}
        onclick={() => {
          if (onselect && (name === 'channels' || name === 'dms')) onselect(name);
          else m.route.set(tabUrl(name));
        }}
      >
        <Icon name={icon} />
        <span className="c-footer__label">{label}</span>
        {indicator}
      </button>
    );

    return (
      <nav className="c-footer">
        {tab('channels', 'fas fa-comments', ct('channel_list.title'), UnreadIndicator(publicUrgent, publicUnread, 'c-unread-indicator'))}
        {canDirectMessage() && tab('dms', 'fas fa-users', ct('direct_messages.title'), UnreadIndicator(dmUrgent, false, 'c-unread-indicator'))}
        {tab('threads', 'fas fa-list-ul', ct('my_threads.title'), null)}
        {tab('search', 'fas fa-magnifying-glass', ct('search.short_title'), null)}
      </nav>
    );
  }
}

function canDirectMessage(): boolean {
  return !!app.forum.attribute<boolean>('canStartChatDirect') || !!chatState()?.directChannels().length;
}

function sorted(channels: RamonChannel[], section: 'channels' | 'direct'): RamonChannel[] {
  const sort = sidebarHooks.sortChannels;

  return sort ? safely(() => sort(channels.slice(0), section), channels) : channels;
}

/** "Nova mensagem": o gancho dos recursos (features/newMessage), quando existe. */
function newMessage(): (() => void) | null {
  const open = sidebarHooks.newMessage;

  return open && app.forum.attribute<boolean>('canStartChatDirect') ? open : null;
}

export interface ChannelRowAttrs extends ComponentAttrs {
  channel: RamonChannel;
  inDrawer: boolean;
  leave?: boolean;
  onopen?: (channel: RamonChannel) => void;
}

/** A linha do canal (chat-channel-row), com o "x" de fechar nas MDs. */
export class ChannelRow extends Component<ChannelRowAttrs> {
  private leaving = false;

  view(): Mithril.Children {
    const { channel, inDrawer, leave, onopen } = this.attrs;
    const id = Number(channel.id());
    const direct = channel.isDirect();
    const mentions = channel.unreadMentionsCount() ?? 0;
    const unread = channel.hasUnread();
    const urgent = direct ? (channel.isMuted() ? 0 : channel.unreadCount() ?? 0) : mentions;
    const active = !inDrawer && chatState()?.activeChannelId === id && String(app.current.get('routeName') || '').startsWith('chat.channel');
    const last: any = (channel as any).lastMessage?.();
    const lastAt: Date | null = (channel as any).lastMessageAt?.() || null;

    return (
      <a
        className={classList('chat-channel-row', {
          active,
          muted: channel.isMuted(),
          'has-unread': unread || urgent > 0,
          'can-leave': leave && !phone(),
          '-fade-out': this.leaving,
        })}
        href={channelUrl(id)}
        data-chat-channel-id={id}
        onclick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();

          if (onopen) onopen(channel);
          else openChannel(id);
        }}
      >
        <div className={classList('chat-channel-row__content', direct ? 'is-dm' : 'is-category')}>
          <div className={classList('chat-channel-icon', direct ? '--avatar' : '--emoji')}>{ramonChannelIcon(channel, 'CanelaRamonChatListIcon')}</div>
          <div className="chat-channel-row__info">
            <div className="chat-channel-row__name-container">
              <div className="chat-channel-name">
                <span className="chat-channel-name__label">{channel.displayName()}</span>
              </div>
              {channel.isPrivate() && !direct && (
                <span className="chat-channel-row__starred-icon">
                  <Icon name="fas fa-lock" />
                </span>
              )}
              {sidebarHooks.channelSuffix && safely(() => sidebarHooks.channelSuffix!(channel), null)}
            </div>
            <div className="chat-channel__metadata">
              {direct && lastAt && <div className="chat-channel__metadata-date">{shortTime(lastAt)}</div>}
              {UnreadIndicator(urgent, unread)}
            </div>
            {direct && phone() && last?.content && <div className="chat-channel__last-message">{excerpt(last)}</div>}
          </div>
          {leave && !phone() && (
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

  /** O "x" da MD: some da lista com a animação do Discourse e sai da conversa. */
  private leave(): void {
    this.leaving = true;

    leaveDirect(this.attrs.channel).then((left) => {
      if (!left) this.leaving = false;
      m.redraw();
    });
  }
}

/** O começo do texto da última mensagem, sem as marcações. */
function excerpt(message: any): string {
  const html = String(message.contentHtml?.() || message.content?.() || '');
  const div = document.createElement('div');
  div.innerHTML = html;

  return (div.textContent || '').trim().slice(0, 120);
}

export interface ChannelsListAttrs extends ComponentAttrs {
  which: 'public' | 'direct' | 'all';
  inDrawer: boolean;
  onopen?: (channel: RamonChannel) => void;
  onbrowse?: () => void;
}

/** As listas de canais e de MDs (channels-list do Discourse). */
export class ChannelsList extends Component<ChannelsListAttrs> {
  view(): Mithril.Children {
    const { which, inDrawer } = this.attrs;

    return (
      <div className={classList('channels-list', { 'public-channels': which === 'public', 'direct-message-channels': which === 'direct' })}>
        {which !== 'direct' && this.publicSection(inDrawer, which === 'all')}
        {which !== 'public' && canDirectMessage() && this.directSection(inDrawer, which === 'all')}
      </div>
    );
  }

  private browse(): void {
    if (this.attrs.onbrowse) this.attrs.onbrowse();
    else m.route.set(app.route('chat.browse'));
  }

  private publicSection(inDrawer: boolean, withDivider: boolean): Mithril.Children {
    const state = chatState();
    const channels = sorted(state?.categoryChannels() || [], 'channels');

    return (
      <div className="channels-list-container public-channels">
        {(withDivider || inDrawer) && (
          <div className="chat-channel-divider public-channels-section">
            <span className="channel-title">{ct('chat_channels')}</span>
            <div className="chat-channel-divider__actions">
              <Tooltip text={ct('browse_all_channels')} container="body" position={inDrawer ? 'left' : 'top'}>
                <button
                  type="button"
                  className="Button Button--icon Button--flat open-browse-page-btn"
                  aria-label={ct('browse_all_channels')}
                  onclick={() => this.browse()}
                >
                  <Icon name="fas fa-pencil" />
                </button>
              </Tooltip>
            </div>
          </div>
        )}
        {channels.length ? (
          channels.map((channel) => <ChannelRow key={channel.id()} channel={channel} inDrawer={inDrawer} onopen={this.attrs.onopen} />)
        ) : state?.channelsLoaded ? (
          <div className="channels-list__empty">
            <p>{ct('no_public_channels')}</p>
            <button type="button" className="Button Button--primary" onclick={() => this.browse()}>
              {ct('no_public_channels_cta')}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  private directSection(inDrawer: boolean, withDivider: boolean): Mithril.Children {
    const state = chatState();
    const channels = sorted(state?.directChannels() || [], 'direct');
    const create = newMessage();

    return (
      <div className="channels-list-container direct-message-channels">
        {(withDivider || inDrawer) && (
          <div className="chat-channel-divider direct-message-channels-section">
            <span className="channel-title">{ct('direct_messages.title')}</span>
            {create && (
              <div className="chat-channel-divider__actions">
                <Tooltip text={ct('direct_messages.new_group')} container="body" position={inDrawer ? 'left' : 'top'}>
                  <button
                    type="button"
                    className="Button Button--icon Button--flat open-draft-channel-page-btn"
                    aria-label={ct('direct_messages.new_group')}
                    onclick={() => create()}
                  >
                    <Icon name="fas fa-plus" />
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        )}
        {channels.length ? (
          channels.map((channel) => <ChannelRow key={channel.id()} channel={channel} inDrawer={inDrawer} leave onopen={this.attrs.onopen} />)
        ) : state?.channelsLoaded ? (
          <div className="channels-list__empty">
            <p>{ct('no_direct_message_channels')}</p>
            {create && (
              <button type="button" className="Button Button--primary" onclick={() => create()}>
                {ct('no_direct_message_channels_cta')}
              </button>
            )}
          </div>
        ) : null}
      </div>
    );
  }
}

/** "Fechar chat em tela cheia": a conversa (ou a lista) passa para a gaveta e a página volta ao fórum. */
export function toDrawer(): void {
  const drawer: any = (flarum as any).reg.checkModule('ramon-chat', 'forum/components/ChatDrawer');

  m.route.set(app.route('index'));

  if (drawer?.open) setTimeout(() => drawer.open().catch(() => {}), 0);
}

/** O chat está disponível e a integração ligada (o resto do arquivo supõe isso). */
export function homeAvailable(): boolean {
  return canUseChat() && !!chatState();
}

export interface DrawerHomeAttrs extends ComponentAttrs {
  onopen: (channel: RamonChannel) => void;
}

/**
 * A lista da gaveta (a do chat do tema): a seção "Canais" com o lápis, ou as
 * MDs, e as abas de baixo. "Meus fios" e "Pesquisar" abrem a página cheia,
 * onde essas telas moram no ramon/chat.
 */
export class DrawerHome extends Component<DrawerHomeAttrs> {
  private tab: 'channels' | 'dms' = 'channels';

  view(): Mithril.Children {
    return (
      <div className={`c-drawer-routes c-routes --${this.tab === 'dms' ? 'direct-messages' : 'channels'} CanelaRamonChatDrawerHome`}>
        <div className="chat-drawer-content">
          <ChannelsList which={this.tab === 'dms' ? 'direct' : 'public'} inDrawer onopen={this.attrs.onopen} />
        </div>
        <ChatFooter
          current={this.tab}
          onselect={(tab: ChatTab) => {
            this.tab = tab === 'dms' ? 'dms' : 'channels';
          }}
        />
      </div>
    );
  }
}
