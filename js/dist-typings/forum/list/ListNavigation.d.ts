import Component, { type ComponentAttrs } from 'flarum/common/Component';
import IndexPage from 'flarum/forum/components/IndexPage';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
import { type CanelaTag } from '../utils/tags';
export interface ListNavigationAttrs extends ComponentAttrs {
    /** A página que fornece viewItems/actionItems — ausente na página de categorias. */
    page?: IndexPage;
}
interface NavTab {
    key: string;
    label: Mithril.Children;
    href: string;
    active: boolean;
}
/** Linha de um dropdown da barra: uma tag ou uma opção especial. */
interface DropRow {
    key: string;
    href: string;
    tag?: CanelaTag;
    parent?: CanelaTag;
    label?: string;
    special?: boolean;
    selected?: boolean;
}
export default class ListNavigation extends Component<ListNavigationAttrs> {
    view(): Mithril.Children;
    startItems(): ItemList<Mithril.Children>;
    endItems(): ItemList<Mithril.Children>;
    /** As abas na ordem do tema; ordenações de extensões entram depois de "Melhores". */
    tabs(): NavTab[];
    /**
     * Ordenações que vão para o menu "mais". "Novos" é a lista de
     * tópicos não vistos, que só existe para quem está logado; para visitantes
     * o "mais novos" do Flarum fica no menu, e as abas são as de quem
     * não entrou (Recentes, Em alta, Melhores, Categorias).
     */
    overflowKeys(): string[];
    overflowTabs(): NavTab[];
    overflowDropdown(tabs: NavTab[]): Mithril.Children;
    compactSelect(tabs: NavTab[]): Mithril.Children;
    dropdownItems(): ItemList<Mithril.Children>;
    /**
     * O dropdown de categoria/etiqueta: cabeçalho com "›" que vira
     * "⌄" aberto, corpo com "Pesquisar…" e a lupa, as opções especiais em
     * negrito na cor de destaque e as categorias "ícone Nome × N".
     */
    drop(options: {
        className: string;
        selected: boolean;
        header: Mithril.Children;
        label: string;
        rows: DropRow[];
        symbols: boolean;
        limit?: number;
    }): Mithril.Children;
    newTopicButton(): Mithril.Children;
}
export {};
