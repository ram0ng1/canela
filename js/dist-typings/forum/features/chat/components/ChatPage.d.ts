import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import type Mithril from 'mithril';
import type { ChatRoute } from '../types';
/** Lê a rota do chat a partir da URL da página. */
export declare function parseRoute(): ChatRoute;
export default class ChatPage extends Page<IPageAttrs> {
    private sideWidth;
    oninit(vnode: Mithril.Vnode<IPageAttrs, this>): void;
    oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    view(): Mithril.Children;
    /** O painel do fio se arrasta pela borda esquerda, como o chat-side-panel-resizer. */
    private resize;
}
