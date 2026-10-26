import Page, { type IPageAttrs } from 'flarum/common/components/Page';
import type Model from 'flarum/common/Model';
import type Mithril from 'mithril';
import { type SearchQuery } from './query';
import { type SearchTab } from './sources';
export default class SearchPage extends Page<IPageAttrs> {
    tab: SearchTab;
    sort: string;
    /** O texto do campo, com os gambits. */
    raw: string;
    query: SearchQuery;
    items: Model[];
    total: number | null;
    hasMore: boolean;
    loading: boolean;
    searched: boolean;
    failed: boolean;
    oninit(vnode: Mithril.Vnode<IPageAttrs, this>): void;
    oncreate(vnode: Mithril.VnodeDOM<IPageAttrs, this>): void;
    view(): Mithril.Children;
    tabs(): [SearchTab, string][];
    tabsView(): Mithril.Children;
    formView(): Mithril.Children;
    filtersAvailable(): boolean;
    controlsView(): Mithril.Children;
    updateQuery(query: SearchQuery): void;
    sortView(): Mithril.Children;
    /** Etiquetas e usuários só se buscam por texto; tópicos e postagens, também por filtros. */
    canSearch(): boolean;
    /** Há texto, mas curto demais para buscar. */
    tooShort(): boolean;
    resultsView(): Mithril.Children;
    itemView(item: Model, pattern: RegExp | undefined): Mithril.Children;
    load(offset: number): void;
    go(raw: string, tab: SearchTab, sort: string | undefined): void;
}
