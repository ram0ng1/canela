import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface ThreadListAttrs extends ComponentAttrs {
    channelId?: number;
    inDrawer: boolean;
}
/** Os fios de um canal, ou — sem canal — os do leitor em todos os canais. */
export declare class ThreadList extends Component<ThreadListAttrs> {
    private threads;
    oninit(vnode: Mithril.Vnode<ThreadListAttrs, this>): void;
    private load;
    view(): Mithril.Children;
}
export interface PinsListAttrs extends ComponentAttrs {
    channelId: number;
    inDrawer: boolean;
}
/** "Mensagens fixadas": a lista, do mais recente, com quem fixou e o desafixar. */
export declare class PinsList extends Component<PinsListAttrs> {
    private messages;
    oninit(vnode: Mithril.Vnode<PinsListAttrs, this>): void;
    view(): Mithril.Children;
    private unpin;
}
export interface ChatSearchAttrs extends ComponentAttrs {
    inDrawer: boolean;
    channelId?: number;
}
/** "Pesquisar no chat": nas mensagens de todos os canais, por relevância ou data. */
export declare class ChatSearch extends Component<ChatSearchAttrs> {
    private query;
    private sort;
    private results;
    private loading;
    private timer;
    view(): Mithril.Children;
    private schedule;
    private search;
}
