/*
 * As seções "Canais" e "Mensagens diretas" do ramon/chat na barra lateral do
 * tema — o modo combinado, em que o chat mora na barra principal
 * (embaixo das categorias e etiquetas) e a página do chat não tem uma segunda
 * coluna de canais.
 *
 * - Canais: no topo, os atalhos do chat ("Meus fios", "Pesquisar",
 *   "Salvos" e, para moderadores, "Denúncias" com a contagem); depois cada
 *   canal com o ícone dele, o número verde das menções ou o pontinho das não
 *   lidas. O lápis do cabeçalho leva a "Navegar por todos os canais".
 * - Mensagens diretas: os avatares, os nomes e o "+" de nova conversa.
 *
 * Tudo lido do estado global do ramon/chat (o mesmo que a página e a gaveta
 * usam): o tempo real dele atualiza as contagens aqui sem nada a mais.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../../components/CanelaSidebar';
import SidebarSection from '../../components/SidebarSection';
import { t } from '../../utils/settings';
import { thirdParty } from '../settings';
import { canUseChat, channelUrl, chatState, onChatPage, openChannel, openRoute, ramonChannelIcon, type RamonChannel } from './bridge';
import { safely, sidebarHooks } from './hooks';

/** Tradução do ramon/chat já como texto (os rótulos que ele mesmo usa). */
function rt(key: string, params: Record<string, unknown> = {}): string {
  return app.translator.trans(`ramon-chat.forum.${key}`, params, true) as string;
}

/** A rota atual do Flarum (`chat.threads`, `chat.channel`…). */
function routeName(): string {
  return String(app.current.get('routeName') || '');
}

/** O indicador: o número verde das menções ou o ponto das não lidas. */
function unreadIndicator(mentions: number, unread: boolean): Mithril.Children {
  if (mentions > 0) {
    return <span className="CanelaRamonChat-unread -urgent">{mentions > 99 ? '99+' : mentions}</span>;
  }

  return unread ? <span className="CanelaRamonChat-unread" /> : null;
}

/** Um link da barra que navega pelo roteador (e abre em nova aba com Ctrl/meio). */
function routeLink(key: string, route: string, icon: string, label: string, badge = 0): Mithril.Children {
  const active = routeName() === route;

  return (
    <li key={key} className={`item-${key}`}>
      <a
        className={classList('LinkButton CanelaRamonChatLink', { active })}
        href={app.route(route)}
        active={String(active)}
        onclick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          openRoute(route);
        }}
      >
        <Icon name={icon} className="Button-icon" />
        <span className="Button-label">{label}</span>
        {badge > 0 && <span className="CanelaRamonChatLink-suffix">{unreadIndicator(badge, false)}</span>}
      </a>
    </li>
  );
}

function channelLink(channel: RamonChannel): Mithril.Children {
  const id = Number(channel.id());
  const active = onChatPage() && ['chat.channel', 'chat.thread'].includes(routeName()) && chatState()?.activeChannelId === id;
  const mentions = channel.unreadMentionsCount() ?? 0;
  const unread = channel.hasUnread();

  return (
    <li key={`channel${id}`} className="CanelaRamonChatItem">
      <a
        className={classList('LinkButton CanelaRamonChatLink', channel.isDirect() ? '--direct' : '--channel', {
          active,
          muted: channel.isMuted(),
          'has-unread': unread || mentions > 0,
        })}
        href={channelUrl(id)}
        active={String(active)}
        title={channel.description() || channel.displayName()}
        // Como na lista do próprio ramon/chat: o pedido da conversa sai quando o
        // ponteiro para na linha (ou no toque), antes do clique.
        onpointerdown={() => chatState()?.prefetchChannel(id)}
        onclick={(e: MouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          e.preventDefault();
          openChannel(id);
        }}
      >
        <span className="CanelaRamonChatLink-prefix">{ramonChannelIcon(channel, 'CanelaRamonChatLink-icon')}</span>
        <span className="Button-label">{channel.displayName()}</span>
        {channel.isPrivate() && <Icon name="fas fa-lock" className="CanelaRamonChatLink-lock" />}
        {sidebarHooks.channelSuffix && safely(() => sidebarHooks.channelSuffix!(channel), null)}
        <span className="CanelaRamonChatLink-suffix">{unreadIndicator(mentions, unread)}</span>
      </a>
    </li>
  );
}

/** Lista vazia: o convite ("Explorar canais", "Iniciar uma conversa"). */
function emptyLink(key: string, icon: string, label: string, onclick: () => void, href: string): Mithril.Children {
  return (
    <li key={key} className="CanelaRamonChatItem --empty">
      <a
        className="LinkButton CanelaRamonChatLink --empty"
        href={href}
        onclick={(e: MouseEvent) => {
          e.preventDefault();
          onclick();
        }}
      >
        <Icon name={icon} className="Button-icon" />
        <span className="Button-label">{label}</span>
      </a>
    </li>
  );
}

/** A ordem do gancho (estrela primeiro, por exemplo) ou a do próprio ramon/chat. */
function sorted(channels: RamonChannel[], section: 'channels' | 'direct'): RamonChannel[] {
  const sort = sidebarHooks.sortChannels;

  return sort ? safely(() => sort(channels.slice(0), section), channels) : channels;
}

/** A lista de canais é pedida uma vez por sessão, na primeira vez que a barra aparece. */
let requested = false;

export default function installRamonChatSidebar(): void {
  extend(CanelaSidebar.prototype, 'sectionItems', function (items: ItemList<Mithril.Children>) {
    if (!thirdParty.ramonChatSidebar() || !canUseChat()) return;

    const state = chatState();

    if (!state) return;

    // O ramon/chat só busca a lista quando a gaveta ou a página abrem; a barra
    // precisa dela antes. O pedido é o mesmo (e fica no cache dele).
    if (!requested && !state.channelsLoaded && !state.channelsLoading) {
      requested = true;
      state.loadChannels().then(
        () => m.redraw(),
        () => {
          requested = false;
        }
      );
    }

    const channels = sorted(state.categoryChannels(), 'channels');
    const canModerate = !!app.forum.attribute<boolean>('canModerateChat');
    const flags = Number(app.forum.attribute<number>('chatOpenFlagsCount') ?? 0);

    const channelItems: Mithril.Children[] = [
      routeLink('chatThreads', 'chat.threads', 'fas fa-comments', t('chat.my_threads.title')),
      routeLink('chatSearch', 'chat.search', 'fas fa-magnifying-glass', t('chat.search.short_title')),
      routeLink('chatBookmarks', 'chat.bookmarks', 'far fa-bookmark', rt('sidebar.bookmarks')),
    ];

    if (canModerate) channelItems.push(routeLink('chatFlags', 'chat.flags', 'far fa-flag', rt('sidebar.flags'), flags));

    if (channels.length) channelItems.push(...channels.map(channelLink));
    else if (state.channelsLoaded)
      channelItems.push(
        emptyLink('chatBrowse', 'fas fa-list', t('chat.no_public_channels_cta'), () => openRoute('chat.browse'), app.route('chat.browse'))
      );

    items.add(
      'ramonChatChannels',
      <SidebarSection
        name="ramon-chat-channels"
        title={t('chat.chat_channels')}
        editLabel={t('chat.browse_all_channels')}
        onEdit={() => openRoute('chat.browse')}
      >
        {channelItems}
      </SidebarSection>,
      60
    );

    const direct = sorted(state.directChannels(), 'direct');
    // O "+" só existe com o gancho da "Nova mensagem" (thirdparty/ramonChat/features).
    const newMessage = sidebarHooks.newMessage;
    const canStart = !!app.forum.attribute<boolean>('canStartChatDirect') && !!newMessage;

    if (!direct.length && !canStart) return;

    items.add(
      'ramonChatDirect',
      <SidebarSection
        name="ramon-chat-direct"
        title={t('chat.direct_messages.sidebar_title')}
        editLabel={canStart ? t('chat.direct_messages.new_group') : undefined}
        editIcon="fas fa-plus"
        onEdit={canStart ? () => newMessage!() : undefined}
      >
        {direct.length
          ? direct.map(channelLink)
          : canStart && state.channelsLoaded
            ? [emptyLink('chatNewMessage', 'fas fa-plus', t('chat.no_direct_message_channels_cta'), () => newMessage!(), app.route('chat.index'))]
            : []}
      </SidebarSection>,
      55
    );
  });
}
