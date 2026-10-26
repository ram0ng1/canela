import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import type { SearchQuery, SearchStatus } from './query';
export interface AdvancedFiltersAttrs extends ComponentAttrs {
    query: SearchQuery;
    onchange: (query: SearchQuery) => void;
    /** Na aba de postagens só parte dos filtros vale; o resto fica apagado. */
    postsOnly: boolean;
}
export default class AdvancedFilters extends Component<AdvancedFiltersAttrs> {
    /** Sugestões do campo de autor (datalist nativo: teclado e leitor de tela de graça). */
    authorSuggestions: User[];
    authorTimer: ReturnType<typeof setTimeout> | undefined;
    listId: string;
    view(): Mithril.Children;
    field(label: string, control: Mithril.Children): Mithril.Children;
    check(label: string, checked: boolean, onchange: (value: boolean) => void, disabled?: boolean): Mithril.Children;
    set(patch: Partial<SearchQuery>): void;
    categoryOptions(): Mithril.Children;
    tagsControl(): Mithril.Children;
    statusOptions(): [SearchStatus, string][];
    authorInput(value: string): void;
    onremove(vnode: Mithril.VnodeDOM<AdvancedFiltersAttrs, this>): void;
}
