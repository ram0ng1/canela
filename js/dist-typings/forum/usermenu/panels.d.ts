import Component from 'flarum/common/Component';
import type { ComponentAttrs } from 'flarum/common/Component';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
import { type NotificationFilter } from './notifications';
import { umText } from './text';
import { type ChatReport } from '../thirdparty/ramonChat/features/reviewData';
/** Tradução rica (com `<a>`, `<b>` e ícones): o `t()` do tema devolve só texto. */
export declare function um(key: string, params?: Record<string, unknown>): Mithril.Children;
/** A mesma, como texto (title, aria-label); mora em text.ts, que o pacote principal usa. */
export { umText };
/**
 * A lista ainda não recebeu nenhuma resposta (nem vazia)? O PaginatedListState
 * guarda uma página por resposta, mesmo sem itens: sem página, "nenhum item"
 * ainda não significa nada e o aviso de lista vazia piscaria antes dos itens.
 */
export declare function neverLoaded(state: any): boolean;
/** As "preferências de notificação" do Flarum ficam nas Configurações. */
export declare function preferencesLink(): Mithril.Vnode<any, any>;
export declare function EmptyState(title: Mithril.Children, body?: Mithril.Children[]): Mithril.Children;
export declare const emptyStates: {
    notifications: () => Mithril.Children;
    likes: () => Mithril.Children;
    messages: () => Mithril.Children;
    bookmarks: () => Mithril.Children;
    other: () => Mithril.Children;
    chat: () => Mithril.Children;
    generic: () => Mithril.Children;
};
export declare function Spinner(): Mithril.Children;
/**
 * A lista de notificações ainda sem resposta: linhas com a altura de um item
 * (avatar e duas linhas de texto, cada barra com a altura de uma linha do
 * texto real), em vez do spinner: o painel já abre no tamanho de uma lista e
 * não salta quando ela chega.
 */
export declare function NotificationSkeleton(rows?: number): Mithril.Children;
/**
 * O `.panel-body-bottom`: o botão largo com a setinha leva à página completa
 * da aba; "Descartar" marca como lidas.
 */
export declare function PanelBottom(attrs: {
    showAllHref?: string | null;
    showAllTitle?: string;
    dismiss?: (() => unknown) | null;
    dismissTitle?: string;
}): JSX.Element;
export interface NotificationsPanelAttrs extends ComponentAttrs {
    filter: NotificationFilter;
    empty: () => Mithril.Children;
    showAllHref?: string | null;
    showAllTitle?: string;
    dismissTitle?: string;
    /** Itens extras antes das notificações (os marcadores usam). */
    extra?: () => Mithril.Children[];
}
export declare class NotificationsPanel extends Component<NotificationsPanelAttrs> {
    extraPages: number;
    view(): string | number | boolean | Mithril.Vnode<any, any> | Mithril.ChildArray | JSX.Element[] | null | undefined;
    oncreate(vnode: Mithril.VnodeDOM<NotificationsPanelAttrs, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<NotificationsPanelAttrs, this>): void;
    wantsMore(): boolean;
    /** Numa aba filtrada com poucos itens, busca as próximas páginas (até 3). */
    fill(): void;
}
export declare class MessagesPanel extends Component {
    /**
     * Já houve uma resposta da lista? Antes dela, "nenhuma conversa" ainda não
     * quer dizer nada: o primeiro desenho acontecia antes do pedido começar e o
     * aviso de "Você não tem mensagens" piscava antes dos itens.
     */
    ready: boolean;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    view(): string | number | boolean | Mithril.Vnode<any, any> | Mithril.ChildArray | JSX.Element[] | null | undefined;
}
export declare class BookmarksPanel extends Component {
    bookmarks: any[];
    loading: boolean;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    view(): string | number | boolean | Mithril.Vnode<any, any> | Mithril.ChildArray | JSX.Element[] | null | undefined;
}
export declare class ReviewPanel extends Component {
    /** As denúncias do chat (ramon/chat), na mesma lista dos posts. */
    chatReports: ChatReport[];
    chatLoading: boolean;
    oncreate(vnode: Mithril.VnodeDOM<any, this>): void;
    view(): string | number | boolean | Mithril.Vnode<any, any> | Mithril.ChildArray | JSX.Element[] | null | undefined;
}
export declare function ProfilePanel(items: ItemList<Mithril.Children>): Mithril.Children;
export declare function isMessagesEnabled(): boolean;
