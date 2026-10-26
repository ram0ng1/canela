import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import type Mithril from 'mithril';
import { type BadgeRow } from './api';
export interface GrantBadgeModalAttrs extends IFormModalAttrs {
    /** Os emblemas que aceitam concessão manual. */
    badges: BadgeRow[];
    badgeId?: string;
    ongrant: () => void;
}
/**
 * Conceder um emblema: escolher o emblema e a pessoa (com
 * sugestões da busca de usuários), mais um motivo ou link opcional. A pessoa
 * recebe a notificação "Ganhou …".
 */
export default class GrantBadgeModal extends FormModal<GrantBadgeModalAttrs> {
    badgeId: string;
    username: string;
    reason: string;
    suggestions: {
        username: string;
        displayName: string;
    }[];
    error: string | null;
    done: string | null;
    searchTimer: ReturnType<typeof setTimeout> | undefined;
    oninit(vnode: Mithril.Vnode<GrantBadgeModalAttrs, this>): void;
    className(): string;
    title(): string;
    content(): JSX.Element;
    search(value: string): void;
    onsubmit(e: SubmitEvent): void;
}
export declare function openGrantModal(badges: BadgeRow[], badgeId: string | undefined, ongrant: () => void): void;
