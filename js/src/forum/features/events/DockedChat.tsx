/*
 * O chat do evento ao lado do tópico: uma coluna fixa de 400px à direita, da altura da tela, com o canal do evento
 * (o ChannelView do ramon/chat, sem cabeçalho). O conteúdo abre espaço para
 * ela (a classe no <body>), e a linha do tempo dá lugar à coluna.
 *
 * Só no computador; no celular e no tablet o cartão do evento tem o link
 * "Conversar no chat", que abre o canal na gaveta ou na página do chat.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import { canUseChat, chatState, ramonModule } from '../../thirdparty/ramonChat/bridge';

export interface DockedChatAttrs extends ComponentAttrs {
  channelId: number;
}

export const DOCKED_CLASS = 'CanelaEventChat--docked';

/** A coluna cabe: computador, o leitor usa o chat e há um canal. */
export function canDock(): boolean {
  const screen = app.screen();

  return (screen === 'desktop' || screen === 'desktop-hd') && canUseChat() && !!chatState();
}

export default class DockedChat extends Component<DockedChatAttrs> {
  private ChannelView: any = null;
  private channel: any = null;
  private failed = false;

  oninit(vnode: Mithril.Vnode<DockedChatAttrs, this>) {
    super.oninit(vnode);
    this.load();
  }

  oncreate(vnode: Mithril.VnodeDOM<DockedChatAttrs, this>) {
    super.oncreate(vnode);
    document.body.classList.add(DOCKED_CLASS);
  }

  onremove(vnode: Mithril.VnodeDOM<DockedChatAttrs, this>) {
    super.onremove(vnode);
    document.body.classList.remove(DOCKED_CLASS);
  }

  private async load(): Promise<void> {
    const lazy = ramonModule<{ loadChatUi?: () => Promise<any> }>('forum/utils/lazy');

    try {
      const [ui, channel] = await Promise.all([
        lazy?.loadChatUi?.(),
        app.store.getById('chat-channels' as any, String(this.attrs.channelId)) ||
          app.store.find('chat-channels' as any, String(this.attrs.channelId)),
      ]);

      this.ChannelView = ui?.ChannelView || null;
      this.channel = channel || null;
      this.failed = !this.ChannelView || !this.channel;
    } catch {
      this.failed = true;
    }

    m.redraw();
  }

  view(): Mithril.Children {
    if (this.failed) return null;

    const state = chatState();
    const ChannelView = this.ChannelView;

    return (
      <aside className="CanelaEventChat" aria-label={this.channel?.displayName?.() || ''}>
        {ChannelView && this.channel && state ? <ChannelView channel={this.channel} state={state} embedded /> : <LoadingIndicator />}
      </aside>
    );
  }
}
