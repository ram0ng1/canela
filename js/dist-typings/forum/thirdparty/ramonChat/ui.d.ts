import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import { type RamonChannel } from './bridge';
export type ChatTab = 'channels' | 'dms' | 'threads' | 'search';
/** Tradução do chat do tema (`ramon-canela.forum.chat.*`): os rótulos são os mesmos das telas internas. */
export declare function ct(key: string, params?: Record<string, unknown>): string;
/** O ponto (há não lidas) ou o número verde (menções e MDs), como o UnreadIndicator interno. */
export declare function UnreadIndicator(urgent: number, unread: boolean, className?: string): Mithril.Children;
export interface NavbarAction {
    key: string;
    icon: string;
    title: string;
    onclick: (e: MouseEvent) => void;
    className?: string;
}
/** A barra de cima (c-navbar): voltar, o título e os botões. */
export declare function Navbar(attrs: {
    title: Mithril.Children;
    back?: () => void;
    actions?: NavbarAction[];
    onclick?: () => void;
}): Mithril.Children;
/** O endereço de uma aba na página cheia. */
export declare function tabUrl(tab: ChatTab): string;
/** As abas na página: a lista, MDs, Meus tópicos e Pesquisar. */
export declare function currentTab(): ChatTab | null;
/** Os títulos das listas (os do chat do tema). */
export declare function tabTitle(tab: ChatTab, inDrawer?: boolean): string;
export interface ChatFooterAttrs extends ComponentAttrs {
    current: ChatTab | null;
    /** Na gaveta, as abas da lista trocam aqui, sem sair da página. */
    onselect?: (tab: ChatTab) => void;
}
/** As abas de baixo (c-footer), com o ponto/número de cada uma. */
export declare class ChatFooter extends Component<ChatFooterAttrs> {
    view(): Mithril.Children;
}
export interface ChannelRowAttrs extends ComponentAttrs {
    channel: RamonChannel;
    inDrawer: boolean;
    leave?: boolean;
    onopen?: (channel: RamonChannel) => void;
}
/** A linha do canal (chat-channel-row), com o "x" de fechar nas MDs. */
export declare class ChannelRow extends Component<ChannelRowAttrs> {
    private leaving;
    view(): Mithril.Children;
    /** O "x" da MD: some da lista com uma animação e sai da conversa. */
    private leave;
}
export interface ChannelsListAttrs extends ComponentAttrs {
    which: 'public' | 'direct' | 'all';
    inDrawer: boolean;
    onopen?: (channel: RamonChannel) => void;
    onbrowse?: () => void;
}
/** As listas de canais e de MDs. */
export declare class ChannelsList extends Component<ChannelsListAttrs> {
    view(): Mithril.Children;
    private browse;
    private publicSection;
    private directSection;
}
/** "Fechar chat em tela cheia": a conversa (ou a lista) passa para a gaveta e a página volta ao fórum. */
export declare function toDrawer(): void;
/** O chat está disponível e a integração ligada (o resto do arquivo supõe isso). */
export declare function homeAvailable(): boolean;
export interface DrawerHomeAttrs extends ComponentAttrs {
    onopen: (channel: RamonChannel) => void;
}
/**
 * A lista da gaveta (a do chat do tema): a seção "Canais" com o lápis, ou as
 * MDs, e as abas de baixo. "Meus fios" e "Pesquisar" abrem a página cheia,
 * onde essas telas moram no ramon/chat.
 */
export declare class DrawerHome extends Component<DrawerHomeAttrs> {
    private tab;
    view(): Mithril.Children;
}
