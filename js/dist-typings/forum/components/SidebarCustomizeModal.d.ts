import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
import { type CanelaTag } from '../utils/tags';
import { type SidebarSectionName } from '../utils/sidebarPrefs';
export interface SidebarCustomizeModalAttrs extends IInternalModalAttrs {
    section: SidebarSectionName;
}
/**
 * "Editar a seção": uma lista com busca e caixas de seleção das
 * categorias (ou etiquetas) que aparecem na barra lateral.
 */
export default class SidebarCustomizeModal extends Modal<SidebarCustomizeModalAttrs> {
    selected: Set<string>;
    filter: string;
    oninit(vnode: Mithril.Vnode<SidebarCustomizeModalAttrs, this>): void;
    className(): string;
    title(): string;
    /** O que a seção mostra sem escolha: as primárias, ou as etiquetas mais usadas. */
    defaultTags(): CanelaTag[];
    candidates(): CanelaTag[];
    content(): Mithril.Children;
    toggle(id: string): void;
    save(): void;
    reset(): void;
}
