import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import { type ChatPane } from '../ChatStore';
export interface ChatChannelAttrs extends ComponentAttrs {
    pane: ChatPane;
    targetMessageId?: number | null;
    context: 'channel' | 'thread';
}
export default class ChatChannel extends Component<ChatChannelAttrs> {
    private scroller;
    private unsubscribe;
    private frame;
    private dragging;
    private pins;
    private pinIndex;
    private joining;
    private positioned;
    oninit(vnode: Mithril.Vnode<ChatChannelAttrs, this>): void;
    oncreate(vnode: Mithril.VnodeDOM<ChatChannelAttrs, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<ChatChannelAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<ChatChannelAttrs, this>): void;
    private onFocus;
    view(): Mithril.Children;
    /** Depois de carregar: a mensagem pedida, o "último acesso" ou o fim. */
    private position;
    private scrollToBottom;
    private scrollToMessage;
    private onScroll;
    /** Marca lida a última mensagem que está inteira na tela (com a aba em foco). */
    private trackRead;
    private loadPins;
    /** A faixa "Fixada" do topo: uma fixada por vez, que avança a cada clique. */
    private pinnedBar;
    private jumpTo;
    private skeleton;
    /** "Este é o começo de #canal" / "Comece a conversa com Fulano". */
    private emptyState;
    private previewCard;
    private join;
    private drag;
    private drop;
}
