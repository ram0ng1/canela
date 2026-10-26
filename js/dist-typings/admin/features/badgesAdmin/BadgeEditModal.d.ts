import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import type Mithril from 'mithril';
import { type BadgeAttributes, type BadgeRow } from './api';
export interface BadgeEditModalAttrs extends IFormModalAttrs {
    /** Ausente: emblema novo. */
    badge?: BadgeRow | null;
    /** Se a migração do admin já rodou (imagem, título, concessão manual). */
    adminColumns: boolean;
    onsave: () => void;
}
type Draft = Required<Pick<BadgeAttributes, 'name' | 'icon' | 'type' | 'grouping' | 'enabled' | 'listable' | 'multipleGrant'>> & {
    description: string;
    longDescription: string;
    imageUrl: string;
    allowTitle: boolean;
    manualGrant: boolean;
};
/**
 * Criar ou editar um emblema — o formulário do /admin/badges.
 *
 * Num emblema do sistema, o slug (que liga à regra automática) e as opções
 * da regra (concessão múltipla e manual) não se editam; o resto sim. Só os
 * campos alterados vão para o servidor: um nome do sistema que não foi mexido
 * continua seguindo a tradução de cada idioma.
 */
export default class BadgeEditModal extends FormModal<BadgeEditModalAttrs> {
    draft: Draft;
    original: Draft;
    error: string | null;
    oninit(vnode: Mithril.Vnode<BadgeEditModalAttrs, this>): void;
    className(): string;
    title(): string;
    isSystem(): boolean;
    content(): JSX.Element;
    text(name: keyof Draft, label: string, options?: {
        required?: boolean;
        maxlength?: number;
        multiline?: boolean;
        placeholder?: string;
        help?: string;
    }): JSX.Element;
    toggle(name: keyof Draft, label: string, help?: string): JSX.Element;
    /** Só o que mudou (ou tudo, num emblema novo); textos vazios viram nulos. */
    changes(): Partial<BadgeAttributes>;
    onsubmit(e: SubmitEvent): void;
}
export declare function openBadgeEditor(badge: BadgeRow | null, adminColumns: boolean, onsave: () => void): void;
export {};
