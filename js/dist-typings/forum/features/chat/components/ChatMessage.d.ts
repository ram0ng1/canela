import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import { type ChatPane } from '../ChatStore';
import type { ChatMessage as Message } from '../types';
export interface ChatMessageAttrs extends ComponentAttrs {
    message: Message;
    previous?: Message;
    next?: Message;
    pane: ChatPane;
    context: 'channel' | 'thread' | 'pinned' | 'search';
    interactive?: boolean;
    separator?: boolean;
}
export declare function hideUserInfo(message: Message, previous?: Message): boolean;
export declare function setMenuOpen(id: number | null): void;
export default class ChatMessage extends Component<ChatMessageAttrs> {
    view(): Mithril.Children;
    oncreate(vnode: Mithril.VnodeDOM<ChatMessageAttrs, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<ChatMessageAttrs, this>): void;
    /**
     * Decora o conteúdo da mensagem: a menção ao próprio
     * leitor fica destacada, e os links abrem fora da conversa.
     */
    private decorate;
    private separator;
    private info;
    private leftGutter;
    private inReplyTo;
    /** Leva até a mensagem: rola se ela está carregada, senão recarrega em volta dela. */
    private jumpTo;
    private uploads;
    private reactions;
    private threadIndicator;
    private error;
    private deletedLabel;
    private deletedBy;
    /** Abre a linha recolhida — e as apagadas logo antes, que ela representava. */
    private expand;
    private longPress;
}
export declare function reactionTitle(char: string, userIds: number[], count: number): string;
/** "há 3 min", "há 2 h": o `leaveAgo` do indicador do fio. */
export declare function relativeAgo(date: Date): string;
