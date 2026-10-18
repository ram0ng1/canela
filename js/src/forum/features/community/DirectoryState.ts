/*
 * O estado de uma tabela de usuários (diretório /u ou membros de um grupo):
 * filtros, as páginas já carregadas e o "carregar mais".
 */
import type User from 'flarum/common/models/User';

import { fetchDirectory, pushUsers, type DirectoryParams, type DirectoryRow, type PeriodKey } from './api';

export interface LoadedRow extends DirectoryRow {
  model: User;
}

export default class DirectoryState {
  params: DirectoryParams;
  rows: LoadedRow[] = [];
  columns: string[] = [];
  total: number | null = null;
  hasMore = false;
  loading = false;
  failed = false;

  /** Respostas que chegam fora de ordem (busca digitada rápido) são descartadas. */
  private requestId = 0;

  constructor(params: DirectoryParams) {
    this.params = { ...params };
  }

  /** Troca filtros e recomeça da primeira página. */
  refresh(changes: Partial<DirectoryParams> = {}): Promise<void> {
    this.params = { ...this.params, ...changes, page: 1 };
    this.rows = [];
    this.hasMore = false;

    return this.load();
  }

  loadMore(): Promise<void> {
    if (this.loading || !this.hasMore) return Promise.resolve();

    this.params = { ...this.params, page: (this.params.page || 1) + 1 };

    return this.load();
  }

  /** Clicar na coluna já ordenada inverte o sentido; numa nova, começa do maior. */
  sortBy(column: string): Promise<void> {
    const same = this.currentOrder() === column;
    const dir: 'asc' | 'desc' = same ? (this.params.dir === 'asc' ? 'desc' : 'asc') : column === 'username' ? 'asc' : 'desc';

    return this.refresh({ order: column, dir });
  }

  setPeriod(period: PeriodKey): Promise<void> {
    return this.refresh({ period });
  }

  currentOrder(): string | undefined {
    return this.params.order;
  }

  private load(): Promise<void> {
    const id = ++this.requestId;

    this.loading = true;
    this.failed = false;
    m.redraw();

    return fetchDirectory(this.params)
      .then((payload) => {
        if (id !== this.requestId) return;

        const users = pushUsers(payload.included || []);
        const rows = payload.data.map((row) => ({ ...row, model: users[row.user] })).filter((row): row is LoadedRow => !!row.model);

        this.rows = payload.meta.page > 1 ? [...this.rows, ...rows] : rows;
        this.columns = payload.meta.columns;
        this.total = payload.meta.total;
        this.hasMore = payload.meta.hasMore;

        // O servidor devolve a ordenação que valeu (um parâmetro inválido cai
        // no padrão): o cabeçalho marca a coluna certa.
        this.params = { ...this.params, order: payload.meta.order, dir: payload.meta.dir, period: payload.meta.period };
      })
      .catch(() => {
        if (id === this.requestId) this.failed = true;
      })
      .finally(() => {
        if (id !== this.requestId) return;

        this.loading = false;
        m.redraw();
      });
  }
}
