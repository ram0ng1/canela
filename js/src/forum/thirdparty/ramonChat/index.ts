/*
 * ramon/chat no visual e na navegação do chat próprio do tema (features/chat,
 * o plugin de chat do Discourse) — que dá lugar a ele quando a extensão está
 * ligada; ver o `$yieldsTo` do extend.php.
 *
 * - sidebar: as seções "Canais" e "Mensagens diretas" na barra lateral.
 * - page: a página /chat como a do tema — a lista (Canais/MDs) com a barra
 *   de cima e as abas de baixo, as telas Meus tópicos/Pesquisar/Salvos/
 *   Denúncias com a mesma moldura, e o /chat do computador abrindo a última
 *   conversa.
 * - drawer: a lista da gaveta (com as abas) e a gaveta redimensionável.
 * - actions/composer: o "⋮" das ações da mensagem, o "+" e o emoji do editor.
 * - views: o `<i>` cru dos ícones vira Lucide e a hora no formato do Discourse.
 * - A aba "Chat" do menu do usuário e o botão "Chat" do cartão/perfil moram
 *   no código deles (usermenu/UserMenu.tsx, topic/components/UserCardPopover,
 *   user/installProfile), lendo `thirdParty.ramonChat*`.
 * - O visual: less/forum/thirdparty/RamonChat.less, por cima do Chat.less do
 *   tema (que também compila com o ramon/chat, pelas classes das listas).
 *
 * Os recursos a mais (preferências, "Nova mensagem", estrela…) moram em
 * ./features e usam os ganchos de ./hooks.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import Icon from 'flarum/common/components/Icon';
import type Mithril from 'mithril';

import { forumBool } from '../../utils/settings';
import { thirdParty } from '../settings';
import { chatState } from './bridge';
import installRamonChatSidebar from './sidebar';
import installRamonChatViews, { findByClass } from './views';
import installRamonChatActions from './actions';
import installRamonChatComposer from './composer';
import installRamonChatDrawer from './drawer';
import installRamonChatUserCard from './usercard';
import { ChatFooter, Navbar, ct, toDrawer, type ChatTab, type NavbarAction } from './ui';
import ChatLobby, { LobbyTabs, rememberContinue } from './lobby';

/** Classe do <body> nas telas do chat fora do ChatPage (hoje, "Explorar canais"). */
const SURFACE_CLASS = 'CanelaRamonChatSurface';

const PAGE = 'ext:ramon/chat/forum/components/ChatPage';

/** A barra lateral do tema está ligada e mostra os canais (a página não precisa da coluna dela). */
function sidebarHasChannels(): boolean {
  return thirdParty.ramonChatSidebar() && forumBool('canelaSidebarEnabled', true);
}

function phone(): boolean {
  return window.innerWidth < 768;
}

function addClass(vnode: any, className: string): void {
  const key = 'class' in vnode.attrs ? 'class' : 'className';
  vnode.attrs[key] = `${vnode.attrs[key] || ''} ${className}`.trim();
}

/** As telas de seção do ramon/chat e a aba de baixo de cada uma (Salvos e Denúncias não têm aba). */
const SECTIONS: Record<string, { tab: ChatTab | null; title: () => string }> = {
  'chat.threads': { tab: 'threads', title: () => ct('my_threads.title') },
  'chat.search': { tab: 'search', title: () => ct('search.title') },
  'chat.bookmarks': { tab: null, title: () => app.translator.trans('ramon-chat.forum.sidebar.bookmarks', {}, true) as string },
  'chat.flags': { tab: null, title: () => app.translator.trans('ramon-chat.forum.sidebar.flags', {}, true) as string },
};

function drawerAction(): NavbarAction[] {
  if (phone()) return [];

  return [
    {
      key: 'drawer',
      icon: 'fas fa-down-left-and-up-right-to-center',
      title: ct('close_full_page'),
      className: 'c-navbar__open-drawer-button',
      onclick: () => toDrawer(),
    },
  ];
}

/** A página /chat: a página inicial no lugar da conversa e a moldura das seções. */
function shapePage(this: any, vnode: any): void {
  const routeName = String(this.attrs?.routeName || '');
  const state = chatState();

  // A conversa aberta é a que a página inicial oferece para continuar.
  if ((routeName === 'chat.channel' || routeName === 'chat.thread') && state) rememberContinue(state.activeChannelId);

  // /chat sem canal: a página inicial (Canais ou Mensagens diretas), nunca a
  // última conversa aberta sozinha.
  if (routeName === 'chat.index' && state) {
    if (this.loading) return;

    const tab = m.route.param('tab') === 'dms' ? 'dms' : 'channels';

    vnode.children = [m(ChatLobby as any, { key: 'lobby', tab })];
    addClass(vnode, 'ChatPage--home');
    return;
  }

  const section = SECTIONS[routeName];

  if (!section) return;

  const main = findByClass(vnode, 'ChatPage-main');

  if (!main) return;

  // A moldura da tela: a barra com o título; no computador as abas do topo,
  // no celular as de baixo. O "voltar" do ramon/chat na barra do celular sai.
  const back = phone() && !section.tab ? () => m.route.set(`${app.route('chat.index')}?tab=channels`) : undefined;
  const tabName = routeName.replace('chat.', '');

  main.children = [
    m('div', { key: 'navbar', className: 'CanelaRamonChatSection-navbar' }, [
      Navbar({ title: phone() ? section.title() : ct('heading'), back, actions: drawerAction() }),
      ...(phone() ? [] : [m(LobbyTabs as any, { current: tabName })]),
    ]),
    m('div', { key: 'content', className: 'chat-drawer-content CanelaRamonChatSection-content' }, main.children),
    ...(phone() && section.tab ? [m(ChatFooter as any, { key: 'footer', current: section.tab })] : []),
  ];
  addClass(main, 'ChatPage-main--section');

  if (Array.isArray(vnode.children)) {
    vnode.children = vnode.children.filter(
      (child: any) => !(child && child.attrs && /ChatToolbar(Back|Title)/.test(String(child.attrs.className || '')))
    );
  }
}

export default function installRamonChat(): void {
  installRamonChatSidebar();
  installRamonChatViews();
  installRamonChatComposer();
  installRamonChatDrawer();
  installRamonChatUserCard();

  extend(PAGE as any, 'view', function (this: any, vnode: Mithril.Vnode<any, any>) {
    if (!vnode || typeof vnode !== 'object' || !vnode.attrs || !thirdParty.ramonChat()) return;

    shapePage.call(this, vnode);

    // O CSS esconde a ChatSidebar da página só quando a barra do tema está
    // aberta e com os canais; fechada (ou desligada no admin), ela volta como
    // a coluna de canais do Discourse sem barra lateral.
    if (sidebarHasChannels()) addClass(vnode, 'ChatPage--canelaSidebar');
  });

  // A conversa lembrada da visita anterior é a que a página inicial oferece
  // para continuar (o `boot()` do ramon/chat escolhe a primeira, mas depois).
  extend(PAGE as any, 'oninit', function () {
    rememberContinue(chatState()?.activeChannelId ?? null);
  });

  // "Explorar canais" é uma página à parte (não o ChatPage), sem a classe
  // `ChatFullPage` no <body>: esta faz o CSS tirar dela o fundo tingido e as
  // peças que flutuam atrás, como na página do chat.
  extend('ext:ramon/chat/forum/components/BrowseChannelsPage' as any, 'oncreate', function () {
    if (thirdParty.ramonChat()) document.body.classList.add(SURFACE_CLASS);
  });

  extend('ext:ramon/chat/forum/components/BrowseChannelsPage' as any, 'onremove', function () {
    document.body.classList.remove(SURFACE_CLASS);
  });

  // A cabeça de "Explorar canais" como a do chat do tema: a barra de cima
  // "‹ Canais" (que volta à lista) e o título "Canais".
  extend('ext:ramon/chat/forum/components/BrowseChannelsPage' as any, 'view', function (vnode: any) {
    if (!thirdParty.ramonChat() || !vnode || typeof vnode !== 'object') return;

    const back = findByClass(vnode, 'ChatBrowse-back');

    if (back?.attrs) {
      back.text = undefined;
      back.attrs.onclick = () => m.route.set(`${app.route('chat.index')}?tab=channels`);
      back.children = [m(Icon as any, { name: 'fas fa-chevron-left' }), m('span', { className: 'ChatBrowse-backTitle' }, ct('channel_list.title'))];
    }

    const title = findByClass(vnode, 'ChatBrowse-title');

    if (title) {
      title.text = undefined;
      title.children = [m.fragment({}, [ct('browse.title')])];
    }
  });

  // Por último: os recursos (./features) também mexem nas ações da mensagem, e
  // o "⋮" tem de agrupar as deles. Um extend registrado depois roda depois.
  extend(app as any, 'mount', () => installRamonChatActions());
}
