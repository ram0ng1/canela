import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import type { ChatChannel, ChatRoute } from '../types';
/** Vai para uma rota do chat: dentro da gaveta, ou pela URL na página cheia. */
export declare function go(route: ChatRoute, inDrawer: boolean): void;
export interface ChannelsListAttrs extends ComponentAttrs {
    which: 'public' | 'direct' | 'all';
    inDrawer: boolean;
}
export default class ChannelsList extends Component<ChannelsListAttrs> {
    view(): Mithril.Children;
    private publicSection;
    private directSection;
}
export interface ChannelRowAttrs extends ComponentAttrs {
    channel: ChatChannel;
    inDrawer: boolean;
    leave?: boolean;
}
export declare class ChannelRow extends Component<ChannelRowAttrs> {
    private leaving;
    view(): Mithril.Children;
    /** O "x" da MD: some da lista com uma animação e sai da conversa. */
    private leave;
}
export interface ChatFooterAttrs extends ComponentAttrs {
    current: string;
    inDrawer: boolean;
}
/** As abas de baixo (gaveta e celular), com o pontinho/número de cada uma. */
export declare class ChatFooter extends Component<ChatFooterAttrs> {
    view(): Mithril.Children;
}
/** Carrega um canal que ainda não está no estado (um link direto, uma prévia). */
export declare function ensureChannel(id: number): Promise<ChatChannel | null>;
