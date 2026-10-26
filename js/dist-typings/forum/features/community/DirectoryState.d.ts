import type User from 'flarum/common/models/User';
import { type DirectoryParams, type DirectoryRow, type PeriodKey } from './api';
export interface LoadedRow extends DirectoryRow {
    model: User;
}
export default class DirectoryState {
    params: DirectoryParams;
    rows: LoadedRow[];
    columns: string[];
    total: number | null;
    hasMore: boolean;
    loading: boolean;
    failed: boolean;
    /** Respostas que chegam fora de ordem (busca digitada rápido) são descartadas. */
    private requestId;
    constructor(params: DirectoryParams);
    /** Troca filtros e recomeça da primeira página. */
    refresh(changes?: Partial<DirectoryParams>): Promise<void>;
    loadMore(): Promise<void>;
    /** Clicar na coluna já ordenada inverte o sentido; numa nova, começa do maior. */
    sortBy(column: string): Promise<void>;
    setPeriod(period: PeriodKey): Promise<void>;
    currentOrder(): string | undefined;
    private load;
}
