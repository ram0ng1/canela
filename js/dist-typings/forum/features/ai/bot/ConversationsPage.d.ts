import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import type Mithril from 'mithril';
import { type AiMessage } from './ConversationsState';
export default class ConversationsPage extends Page<IPageAttrs> {
    input: string;
    textarea: HTMLTextAreaElement | null;
    /** Rolar até o fim a cada pedaço só enquanto a pessoa já está no fim. */
    stickToBottom: boolean;
    scrollListener: () => void;
    oninit(vnode: Mithril.Vnode<IPageAttrs, this>): void;
    oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    view(): JSX.Element;
    newConversationView(): Mithril.Children;
    personaSelector(): Mithril.Children;
    remainingView(): Mithril.Children;
    conversationView(): Mithril.Children;
    messageView(message: AiMessage): Mithril.Children;
    inputView(docked: boolean): Mithril.Children;
    submit(): void;
    /** O campo cresce com o texto até 30% da altura da tela. */
    autoExpand(): void;
    onScroll(): void;
    scrollToBottom(): void;
}
