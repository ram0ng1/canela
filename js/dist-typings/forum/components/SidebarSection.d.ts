import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface SidebarSectionAttrs extends ComponentAttrs {
    /** Chave da seção, usada para lembrar se o leitor a recolheu. */
    name: string;
    /** Sem título, a seção não recolhe — é a seção da comunidade, no topo. */
    title?: Mithril.Children;
    /** O lápis de "personalizar seção", que aparece ao passar o mouse no cabeçalho. */
    onEdit?: () => void;
    editLabel?: string;
    /** O ícone do botão do cabeçalho; o padrão é o lápis (o "+" das mensagens diretas do chat é outro). */
    editIcon?: string;
}
/**
 * Seção da barra lateral, com o cabeçalho em versalete e a seta que a recolhe —
 * como as "Categorias" e as "Etiquetas".
 */
export default class SidebarSection extends Component<SidebarSectionAttrs> {
    collapsed: boolean;
    oninit(vnode: Mithril.Vnode<SidebarSectionAttrs, this>): void;
    view(vnode: Mithril.Vnode<SidebarSectionAttrs, this>): JSX.Element;
    toggle(): void;
}
