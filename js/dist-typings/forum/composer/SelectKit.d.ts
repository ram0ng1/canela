import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface SelectKitRow {
    key: string;
    content: Mithril.Children;
    selected?: boolean;
    title?: string;
}
export interface SelectKitAttrs extends ComponentAttrs {
    className?: string;
    header: Mithril.Children;
    /** Ícone à direita do cabeçalho (seta, "+"). */
    caret?: string;
    /** Ícone à direita com o menu aberto. */
    caretOpen?: string;
    rows: (filter: string) => SelectKitRow[];
    onselect: (key: string) => void;
    /** Continua aberto depois de escolher (o seletor de etiquetas). */
    stayOpen?: boolean;
    disabled?: boolean;
    label: string;
    /** A lupa à direita do campo de busca (o de categoria tem; o de etiquetas, não). */
    filterIcon?: boolean;
    /** O que vem entre a busca e a lista (as etiquetas já escolhidas). */
    before?: Mithril.Children;
    /** O que vem depois da lista (o "Filtre para ver mais…" da barra da lista). */
    after?: Mithril.Children | ((filter: string) => Mithril.Children);
    /** Texto do campo de busca (padrão: "Pesquisar…"). */
    placeholder?: string;
    /**
     * Ao abrir, destaca a linha escolhida (ou nenhuma), em vez da primeira —
     * assim o seletor abre sem destacar nada.
     */
    highlightSelected?: boolean;
    emptyText?: string;
}
export default class SelectKit extends Component<SelectKitAttrs> {
    open: boolean;
    filter: string;
    highlighted: number;
    above: boolean;
    private outside;
    view(): Mithril.Children;
    bodyView(): Mithril.Children;
    onkeydown(e: KeyboardEvent, rows: SelectKitRow[]): void;
    scrollHighlightedIntoView(): void;
    choose(key: string): void;
    show(): void;
    close(): void;
    onremove(vnode: Mithril.VnodeDOM<SelectKitAttrs, this>): void;
}
