import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
import { type BadgeRow, type GrantRow } from './api';
export interface BadgeGrantsModalAttrs extends IInternalModalAttrs {
    badge: BadgeRow;
    onchange: () => void;
}
/**
 * Quem ganhou um emblema, das concessões mais recentes às mais antigas, com
 * o "Revogar" de cada uma. Revogar apaga a concessão e a notificação dela.
 */
export default class BadgeGrantsModal extends Modal<BadgeGrantsModalAttrs> {
    rows: GrantRow[];
    loadingRows: boolean;
    hasMore: boolean;
    error: string | null;
    revoking: Set<string>;
    oninit(vnode: Mithril.Vnode<BadgeGrantsModalAttrs, this>): void;
    className(): string;
    title(): string;
    load(offset: number): void;
    content(): JSX.Element;
    row(row: GrantRow): JSX.Element;
    revoke(row: GrantRow): void;
}
export declare function openGrantsModal(badge: BadgeRow, onchange: () => void): void;
