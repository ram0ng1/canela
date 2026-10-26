import type Mithril from 'mithril';
import { AdminComponent } from '../../util';
export declare const KEY = "ramon-canela.admin.settings.bug_reports";
declare const STATUSES: readonly ["open", "reviewed", "in_progress", "fixed", "wontfix"];
declare const FILTERS: readonly ["active", "open", "reviewed", "in_progress", "fixed", "wontfix", "all"];
type Status = (typeof STATUSES)[number];
type Filter = (typeof FILTERS)[number];
interface Report {
    id: number;
    kind: string;
    status: Status;
    description: string;
    currentText: string | null;
    suggestedText: string | null;
    url: string;
    title: string;
    note: string | null;
    hasFull: boolean;
    createdAt: string;
    user: {
        id: number;
        username: string;
        displayName: string;
        avatarUrl: string | null;
    } | null;
    context: {
        viewport?: {
            w: number;
            h: number;
            dpr: number;
        };
        userAgent?: string;
        language?: string;
        route?: string;
        theme?: string;
        elements?: {
            path: string;
            component: string;
            text: string;
        }[];
        consoleErrors?: {
            at: string;
            message: string;
        }[];
    };
}
export declare const statusLabel: (status: string) => string;
export default class ReportManager extends AdminComponent {
    filter: Filter;
    page: number;
    total: number;
    perPage: number;
    counts: Record<string, number>;
    rows: Report[] | null;
    error: string | null;
    openId: number | null;
    notes: Record<number, string>;
    busy: Set<number>;
    /** O aviso curto ao lado do botão de copiar ("Copiado!"), por botão. */
    copied: Record<string, 'ok' | 'fail'>;
    private timer;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    onremove(vnode: Mithril.VnodeDOM<any, this>): void;
    copy(key: string, run: () => Promise<void>): void;
    copiedNote(key: string): JSX.Element | null;
    reload(): void;
    count(filter: Filter): number;
    view(): JSX.Element;
    go(page: number): void;
    item(report: Report): JSX.Element;
    toggle(report: Report): void;
    detail(report: Report): JSX.Element;
    save(report: Report, body: Record<string, string>): void;
    remove(report: Report): void;
}
export {};
