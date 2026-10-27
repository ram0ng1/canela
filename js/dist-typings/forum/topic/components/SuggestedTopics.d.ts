import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';
/** Uma linha da tabela, venha de um modelo do store ou da API de IA. */
interface Row {
    id: string;
    title: string;
    href: string;
    replies: number;
    views: number | null;
    last: Date | null;
    unread: number;
    badges: Mithril.Children;
}
interface Lists {
    suggested: Row[];
    related: Row[];
}
type Tab = keyof Lists;
export interface SuggestedTopicsAttrs extends ComponentAttrs {
    discussion: Discussion;
}
export default class SuggestedTopics extends Component<SuggestedTopicsAttrs> {
    loading: boolean;
    tab: Tab;
    oninit(vnode: Mithril.Vnode<SuggestedTopicsAttrs, this>): void;
    load(): void;
    /** As duas listas, sem repetir em "Relacionado(a)" o que já está em "Sugestões". */
    lists(suggested: Row[], related: Row[]): Lists;
    /** O pedido de "Sugestões" (o servidor pré-carrega o mesmo: os parâmetros são a chave). */
    suggestedParams(discussion: Discussion, limit: number): Record<string, unknown>;
    /** O pedido de "Relacionado(a)" sem IA; null sem etiquetas. Os slugs em ordem alfabética, como no servidor. */
    relatedParams(discussion: Discussion, limit: number): Record<string, unknown> | null;
    rowsOf(discussion: Discussion, results: Discussion[], limit: number): Row[];
    preloadedSuggested(discussion: Discussion, limit: number): Row[] | null;
    preloadedRelated(discussion: Discussion, limit: number): Row[] | null;
    loadSuggested(discussion: Discussion, limit: number): Promise<Row[]>;
    loadRelated(discussion: Discussion, limit: number): Promise<Row[]>;
    view(): JSX.Element | null;
    row(row: Row, views: boolean): JSX.Element;
    /** Como a coluna da lista: o número curto, o title por extenso e o calor (`heatmap-*`). */
    viewsCell(count: number): JSX.Element;
}
export {};
