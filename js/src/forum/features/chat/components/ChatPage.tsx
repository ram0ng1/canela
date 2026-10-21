/*
 * A página cheia do chat (`/chat…`).
 *
 * - No computador, com a barra lateral do tema, a lista de canais mora nela
 *   (seções "Canais" e "Mensagens diretas") e a página mostra só a conversa;
 *   sem a barra lateral, a lista vira a coluna de 275px da esquerda.
 * - O fio abre no painel lateral à direita (chat-side-panel), redimensionável,
 *   com o canal ainda à vista; no celular ele toma a tela.
 * - No celular tudo é tela cheia: a lista com as abas de baixo, e a conversa.
 */
import app from 'flarum/forum/app';
import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import chat from '../ChatStore';
import RouteView from './RouteView';
import ChannelsList from './ChannelsList';
import { chatOn, ct, readLocal, writeLocal } from '../utils';
import { forumBool } from '../../../utils/settings';
import type { ChatRoute } from '../types';

/** Lê a rota do chat a partir da URL da página. */
export function parseRoute(): ChatRoute {
  const name = String(app.current.get('routeName') || m.route.param('routeName') || '');
  const id = Number(m.route.param('id'));
  const rest = String(m.route.param('rest') || '')
    .split('/')
    .filter(Boolean);

  if (name === 'canela.chat.browse' || name === 'canela.chat.browseFilter') return { name: 'browse', filter: m.route.param('filter') };
  if (name === 'canela.chat.newMessage') return { name: 'new-message' };
  if (name === 'canela.chat.directMessages') return { name: 'direct-messages' };
  if (name === 'canela.chat.threads') return { name: 'threads' };
  if (name === 'canela.chat.search') return { name: 'search' };
  if (name === 'canela.chat.channels') return { name: 'channels' };

  if (id) {
    const [first, second, third] = rest;

    if (first === 't' && second) return { name: 'thread', channelId: id, threadId: Number(second), messageId: third ? Number(third) : undefined };
    if (first === 't') return { name: 'channel-threads', channelId: id };
    if (first === 'pins') return { name: 'channel-pins', channelId: id };
    if (first === 'info') return { name: 'channel-info', channelId: id, tab: second === 'members' ? 'members' : 'settings' };
    if (first && /^\d+$/.test(first)) return { name: 'channel', channelId: id, messageId: Number(first) };

    return { name: 'channel', channelId: id };
  }

  return { name: 'channels' };
}

export default class ChatPage extends Page<IPageAttrs> {
  private sideWidth = readLocal<number>('sidePanelWidth', 400);

  oninit(vnode: Mithril.Vnode<IPageAttrs, this>) {
    super.oninit(vnode);

    this.bodyClass = 'has-full-page-chat';

    if (!app.forum.attribute<any>('canelaChat')?.enabled) {
      m.route.set(app.route('index'));
      return;
    }

    chat.prefersFullPage = true;
    writeLocal('fullPage', true);
    chat.drawer.open = false;
    chat.start();

    app.setTitle(ct('title_capitalized'));
    app.setTitleCount(0);

    // Sem rota de canal no computador, abre a última conversa.
    const route = parseRoute();

    if (route.name === 'channels' && app.screen() !== 'phone' && String(app.current.get('routeName')) === 'canela.chat') {
      const last = readLocal<number>('lastChannel', 0);

      if (last) setTimeout(() => m.route.set(`${app.route('canela.chat')}/c/-/${last}`, undefined, { replace: true }), 0);
    }
  }

  oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.oncreate(vnode);
    document.documentElement.classList.add('has-full-page-chat');
  }

  onremove(vnode: Mithril.VnodeDOM<IPageAttrs, this>) {
    super.onremove(vnode);
    document.documentElement.classList.remove('has-full-page-chat');
    chat.activeChannelId = null;
  }

  view(): Mithril.Children {
    if (!chatOn()) {
      return (
        <div className="CanelaChatPage">
          <div className="chat-disabled">
            <div className="empty-state__container">
              <p>{app.session.user ? ct('disabled_for_you') : ct('log_in_to_chat')}</p>
            </div>
          </div>
        </div>
      );
    }

    const route = parseRoute();
    const phone = app.screen() === 'phone';
    const sidebar =
      !phone &&
      forumBool('canelaSidebarEnabled', true) &&
      app.forum.attribute<any>('canelaChat')?.sidebar !== false &&
      document.querySelector('#canela-sidebar') !== null;

    if ('channelId' in route) writeLocal('lastChannel', route.channelId);

    // No computador, o fio fica no painel lateral com o canal ao lado.
    const sidePanel = !phone && route.name === 'thread';
    const main: ChatRoute = sidePanel ? { name: 'channel', channelId: (route as any).channelId } : route;

    return (
      <div className="CanelaChatPage">
        <div className={classList('full-page-chat', { 'full-page-chat-sidebar-enabled': sidebar || phone })}>
          {!sidebar && !phone && (
            <div className="channels-list">
              <ChannelsList which="all" inDrawer={false} />
            </div>
          )}
          <div id="main-chat-outlet" className={classList('main-chat-outlet chat-view', { 'has-side-panel-expanded': sidePanel })}>
            <RouteView route={main} inDrawer={false} sideList={sidebar || !phone} />
            {sidePanel && (
              <div className="chat-side-panel" style={{ width: `${this.sideWidth}px` }}>
                <div className="chat-side-panel-resizer" onpointerdown={(e: PointerEvent) => this.resize(e)} />
                <RouteView route={route} inDrawer={false} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /** O painel do fio se arrasta pela borda esquerda, como o chat-side-panel-resizer. */
  private resize(e: PointerEvent): void {
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = this.sideWidth;
    const panel = (e.currentTarget as HTMLElement).parentElement!;

    const move = (event: PointerEvent) => {
      this.sideWidth = Math.max(250, Math.min(window.innerWidth * 0.6, startWidth + (startX - event.clientX)));
      panel.style.width = `${this.sideWidth}px`;
    };

    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      writeLocal('sidePanelWidth', this.sideWidth);
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }
}
