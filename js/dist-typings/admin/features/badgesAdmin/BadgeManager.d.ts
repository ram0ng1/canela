import type Mithril from 'mithril';
import { AdminComponent } from '../../util';
import { type BadgeRow } from './api';
/**
 * O admin de emblemas, em /admin/badges: todos os emblemas
 * (do sistema e personalizados) com medalha, tipo, concessões e o
 * liga/desliga; e as ações de criar, editar, conceder, ver concessões,
 * remover e restaurar os do sistema.
 */
export default class BadgeManager extends AdminComponent {
    rows: BadgeRow[] | null;
    error: string | null;
    notice: string | null;
    busy: Set<string>;
    restoring: boolean;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    reload(): void;
    grantable(): BadgeRow[];
    adminColumns(): boolean;
    view(): JSX.Element;
    row(row: BadgeRow): JSX.Element;
    toggle(row: BadgeRow, enabled: boolean): void;
    remove(row: BadgeRow): void;
    restore(): void;
}
