import IndexSidebar from 'flarum/forum/components/IndexSidebar';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
import { type SidebarSectionName } from '../utils/sidebarPrefs';
import { type CanelaTag } from '../utils/tags';
/**
 * A barra lateral: botão "Iniciar Discussão", a seção da comunidade
 * (Tópicos, Minhas postagens, Mais…), as categorias e as etiquetas, e um
 * rodapé com o tema claro/escuro e os atalhos de teclado.
 *
 * Herda do IndexSidebar para receber de graça o que as extensões põem na
 * navegação da página inicial — Seguindo, por exemplo —, com o `active` que o
 * LinkButton já calcula.
 */
export default class CanelaSidebar extends IndexSidebar {
    view(): Mithril.Children;
    sectionItems(): ItemList<Mithril.Children>;
    /** O lápis de personalizar a seção. */
    /** Personalizar a barra lateral é só para quem está logado: visitante não vê o lápis. */
    editAttrs(section: SidebarSectionName): {
        editLabel?: undefined;
        onEdit?: undefined;
    } | {
        editLabel: string;
        onEdit: () => Promise<void>;
    };
    /** As tags escolhidas pelo leitor para a seção, na ordem do fórum. */
    pickedTags(section: SidebarSectionName): CanelaTag[] | null;
    newTopicButton(): Mithril.Children;
    communityItems(): ItemList<Mithril.Children>;
    /**
     * A seção principal depois de todas as extensões terem posto os seus itens:
     * na ordem que o leitor escolheu, os que ele mandou esconder vão para dentro
     * do "Mais", e o "Mais" ganha o "Personalizar" com a lista de todos eles.
     */
    communitySection(): ItemList<Mithril.Children>;
    /** "Tópicos" fica ativo na página inicial sem filtro de tag nem de "Seguindo". */
    isIndexActive(): boolean;
    moreItems(): ItemList<Mithril.Children>;
    moreDropdown(moved?: {
        key: string;
        vnode: Mithril.Children;
    }[], entries?: {
        key: string;
        label: string;
        icon?: string;
    }[]): Mithril.Children;
    categoryItems(): ItemList<Mithril.Children>;
    tagItems(): ItemList<Mithril.Children>;
    tagLink(tag: CanelaTag, icon: Mithril.Children, active: boolean): Mithril.Children;
    footerItems(): ItemList<Mithril.Children>;
}
