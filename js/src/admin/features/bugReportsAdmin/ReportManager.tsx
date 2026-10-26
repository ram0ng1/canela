/*
 * O painel dos relatórios, dentro do card "Relatar problema": a lista por
 * status, com a captura, quem enviou, a página e o texto; ao abrir um, a
 * tela inteira, o contexto (tela, navegador, elementos, console), a mudança
 * de status, a nota para quem reportou e o "Apagar". "Exportar" baixa os
 * abertos em Markdown, agrupados por página.
 */
import app from 'flarum/admin/app';
import Button from 'flarum/common/components/Button';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import { AdminComponent, trans } from '../../util';
import { AdminNotice } from '../../components/AdminCard';
import { copyImage, copyText, fetchText } from './clipboard';

export const KEY = 'ramon-canela.admin.settings.bug_reports';

const STATUSES = ['open', 'reviewed', 'in_progress', 'fixed', 'wontfix'] as const;
const FILTERS = ['active', ...STATUSES, 'all'] as const;

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
  user: { id: number; username: string; displayName: string; avatarUrl: string | null } | null;
  context: {
    viewport?: { w: number; h: number; dpr: number };
    userAgent?: string;
    language?: string;
    route?: string;
    theme?: string;
    elements?: { path: string; component: string; text: string }[];
    consoleErrors?: { at: string; message: string }[];
  };
}

const apiUrl = (path: string) => `${((app.forum.attribute<string>('apiUrl') as string) || '/api').replace(/\/+$/, '')}${path}`;

const STATUS_LABELS: Record<Status, string> = {
  open: 'Aberto',
  reviewed: 'Revisado',
  in_progress: 'Em andamento',
  fixed: 'Corrigido',
  wontfix: 'Não será feito',
};

const KIND_LABELS: Record<string, string> = {
  bug: 'Algo não funciona',
  content: 'Texto ou imagem',
  design: 'Design',
  idea: 'Ideia',
};

export const statusLabel = (status: string) => trans(`${KEY}.status_${status}`, STATUS_LABELS[status as Status] || status);
const kindLabel = (kind: string) => trans(`${KEY}.kind_${kind}`, KIND_LABELS[kind] || kind);
const filterLabel = (filter: Filter) =>
  filter === 'active' ? trans(`${KEY}.filter_active`, 'Pendentes') : filter === 'all' ? trans(`${KEY}.filter_all`, 'Todos') : statusLabel(filter);

const date = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default class ReportManager extends AdminComponent {
  filter: Filter = 'active';
  page = 1;
  total = 0;
  perPage = 20;
  counts: Record<string, number> = {};
  rows: Report[] | null = null;
  error: string | null = null;
  openId: number | null = null;
  notes: Record<number, string> = {};
  busy = new Set<number>();
  /** O aviso curto ao lado do botão de copiar ("Copiado!"), por botão. */
  copied: Record<string, 'ok' | 'fail'> = {};
  private timer: ReturnType<typeof setInterval> | null = null;

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    this.reload();

    // Os relatórios novos aparecem sozinhos, sem recarregar a página (só com a
    // aba à vista e sem um relatório aberto, para não mexer no que se lê).
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible' && this.openId === null) this.reload();
    }, 15000);
  }

  onremove(vnode: Mithril.VnodeDOM<any, this>) {
    super.onremove(vnode);

    if (this.timer) clearInterval(this.timer);
  }

  copy(key: string, run: () => Promise<void>): void {
    run()
      .then(() => (this.copied[key] = 'ok'))
      .catch(() => (this.copied[key] = 'fail'))
      .finally(() => {
        m.redraw();
        setTimeout(() => {
          delete this.copied[key];
          m.redraw();
        }, 2500);
      });
  }

  copiedNote(key: string) {
    const state = this.copied[key];

    if (!state) return null;

    return (
      <span className={classList('CanelaBugAdmin-copied', { 'is-fail': state === 'fail' })} role="status">
        {state === 'ok' ? trans(`${KEY}.copied`, 'Copiado!') : trans(`${KEY}.copy_failed`, 'Não deu para copiar.')}
      </span>
    );
  }

  reload(): void {
    app
      .request<{ reports: Report[]; counts: Record<string, number>; total: number; perPage: number }>({
        method: 'GET',
        url: apiUrl('/canela-bug-reports'),
        params: { status: this.filter === 'all' ? '' : this.filter, page: this.page },
      })
      .then((payload) => {
        this.rows = payload.reports || [];
        this.counts = payload.counts || {};
        this.total = payload.total || 0;
        this.perPage = payload.perPage || 20;
        this.error = null;
      })
      .catch(() => (this.error = trans(`${KEY}.load_failed`, 'Não deu para carregar os relatórios. As migrações do tema já rodaram?')))
      .finally(() => m.redraw());
  }

  count(filter: Filter): number {
    const all = Object.values(this.counts).reduce((sum, n) => sum + n, 0);

    if (filter === 'all') return all;
    if (filter === 'active') return all - (this.counts.fixed || 0) - (this.counts.wontfix || 0);

    return this.counts[filter] || 0;
  }

  view() {
    if (this.error && !this.rows) return <AdminNotice icon="fas fa-triangle-exclamation">{this.error}</AdminNotice>;

    if (!this.rows) return <LoadingIndicator display="block" />;

    const pages = Math.max(1, Math.ceil(this.total / this.perPage));

    return (
      <div className="CanelaBugAdmin">
        <div className="CanelaBugAdmin-toolbar">
          <div className="CanelaBugAdmin-filters" role="tablist">
            {FILTERS.map((filter) => (
              <button
                type="button"
                role="tab"
                aria-selected={this.filter === filter ? 'true' : 'false'}
                className={classList('Button Button--flat CanelaBugAdmin-filter', { active: this.filter === filter })}
                onclick={() => {
                  this.filter = filter;
                  this.page = 1;
                  this.openId = null;
                  this.reload();
                }}
              >
                {filterLabel(filter)} <span className="CanelaBugAdmin-count">{this.count(filter)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="CanelaBugAdmin-ai">
          <div className="CanelaBugAdmin-aiText">
            <strong>{trans(`${KEY}.ai_title`, 'Corrigir com IA')}</strong>
            <p>
              {trans(
                `${KEY}.ai_help`,
                'Copie as instruções e cole no ChatGPT, Claude, Gemini ou num agente no seu editor. Elas dizem à IA como reproduzir, escrever o teste, corrigir e verificar, e levam o ambiente do fórum, os relatórios e links das capturas que abrem sem login por 7 dias.'
              )}
            </p>
          </div>
          <div className="CanelaBugAdmin-aiButtons">
            <Button
              className="Button Button--primary"
              icon="fas fa-wand-magic-sparkles"
              disabled={!this.count('active')}
              onclick={() => this.copy('all', () => fetchText(apiUrl('/canela-bug-reports-export')).then(copyText))}
            >
              {trans(`${KEY}.copy_all`, 'Copiar instruções (pendentes)')}
            </Button>
            <a className="Button" href={apiUrl('/canela-bug-reports-export?download=1')} download>
              <i className="icon fas fa-file-arrow-down Button-icon" aria-hidden="true" />
              <span className="Button-label">{trans(`${KEY}.export`, 'Baixar (.md)')}</span>
            </a>
            {this.copiedNote('all')}
          </div>
        </div>

        {this.error && <p className="CanelaAdmin-formError">{this.error}</p>}

        {!this.rows.length ? (
          <p className="CanelaBugAdmin-empty">{trans(`${KEY}.empty`, 'Nenhum relatório aqui.')}</p>
        ) : (
          <ul className="CanelaBugAdmin-list">{this.rows.map((report) => this.item(report))}</ul>
        )}

        {pages > 1 && (
          <div className="CanelaBugAdmin-pager">
            <Button className="Button" icon="fas fa-chevron-left" disabled={this.page <= 1} onclick={() => this.go(this.page - 1)}>
              {trans(`${KEY}.previous`, 'Anterior')}
            </Button>
            <span>{trans(`${KEY}.page_of`, 'Página {page} de {pages}', { page: this.page, pages })}</span>
            <Button className="Button" disabled={this.page >= pages} onclick={() => this.go(this.page + 1)}>
              {trans(`${KEY}.next`, 'Próxima')}
            </Button>
          </div>
        )}
      </div>
    );
  }

  go(page: number): void {
    this.page = page;
    this.openId = null;
    this.reload();
  }

  item(report: Report) {
    const open = this.openId === report.id;

    return (
      <li key={report.id} className={classList('CanelaBugAdmin-item', { open })}>
        <button type="button" className="CanelaBugAdmin-summary" aria-expanded={open ? 'true' : 'false'} onclick={() => this.toggle(report)}>
          <img className="CanelaBugAdmin-thumb" src={apiUrl(`/canela-bug-reports/${report.id}/region`)} alt="" loading="lazy" />
          <span className="CanelaBugAdmin-main">
            <span className="CanelaBugAdmin-meta">
              <span className={`CanelaBugStatus CanelaBugStatus--${report.status}`}>{statusLabel(report.status)}</span>
              <span>#{report.id}</span>
              <span>{kindLabel(report.kind)}</span>
              <span>{report.user ? `@${report.user.username}` : trans(`${KEY}.user_gone`, 'conta removida')}</span>
              <span>{date(report.createdAt)}</span>
            </span>
            <span className="CanelaBugAdmin-description">{report.description}</span>
            <span className="CanelaBugAdmin-page">{report.title || report.url}</span>
          </span>
        </button>
        {open && this.detail(report)}
      </li>
    );
  }

  toggle(report: Report): void {
    this.openId = this.openId === report.id ? null : report.id;
    this.notes[report.id] ??= report.note || '';
  }

  detail(report: Report) {
    const ctx = report.context || {};
    const busy = this.busy.has(report.id);

    return (
      <div className="CanelaBugAdmin-detail">
        <div className="CanelaBugAdmin-images">
          <a href={apiUrl(`/canela-bug-reports/${report.id}/region`)} target="_blank" rel="noopener">
            <img src={apiUrl(`/canela-bug-reports/${report.id}/region`)} alt={trans(`${KEY}.region_alt`, 'Área marcada')} />
          </a>
          {report.hasFull && (
            <a href={apiUrl(`/canela-bug-reports/${report.id}/full`)} target="_blank" rel="noopener">
              <img src={apiUrl(`/canela-bug-reports/${report.id}/full`)} alt={trans(`${KEY}.full_alt`, 'Tela inteira')} />
            </a>
          )}
        </div>

        <p className="CanelaBugAdmin-text">{report.description}</p>

        {(report.currentText || report.suggestedText) && (
          <dl className="CanelaBugAdmin-dl">
            <dt>{trans(`${KEY}.current_text`, 'Texto atual')}</dt>
            <dd>{report.currentText || '—'}</dd>
            <dt>{trans(`${KEY}.suggested_text`, 'Texto sugerido')}</dt>
            <dd>{report.suggestedText || '—'}</dd>
          </dl>
        )}

        <dl className="CanelaBugAdmin-dl">
          <dt>{trans(`${KEY}.page`, 'Página')}</dt>
          <dd>
            {/^https?:\/\//i.test(report.url) ? (
              <a href={report.url} target="_blank" rel="noopener nofollow">
                {report.url}
              </a>
            ) : (
              report.url || '—'
            )}
          </dd>
          {ctx.viewport && (
            <>
              <dt>{trans(`${KEY}.viewport`, 'Tela')}</dt>
              <dd>
                {ctx.viewport.w}×{ctx.viewport.h} @{ctx.viewport.dpr}x{ctx.theme ? ` · ${ctx.theme}` : ''}
              </dd>
            </>
          )}
          {ctx.userAgent && (
            <>
              <dt>{trans(`${KEY}.browser`, 'Navegador')}</dt>
              <dd>
                {ctx.userAgent}
                {ctx.language ? ` · ${ctx.language}` : ''}
              </dd>
            </>
          )}
          {ctx.route && (
            <>
              <dt>{trans(`${KEY}.route`, 'Rota')}</dt>
              <dd>
                <code>{ctx.route}</code>
              </dd>
            </>
          )}
        </dl>

        {!!ctx.elements?.length && (
          <div className="CanelaBugAdmin-block">
            <strong>{trans(`${KEY}.elements`, 'Elementos sob a área')}</strong>
            <ul>
              {ctx.elements.map((el) => (
                <li>
                  <code>{el.path}</code>
                  {el.text ? ` — "${el.text}"` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!!ctx.consoleErrors?.length && (
          <div className="CanelaBugAdmin-block">
            <strong>{trans(`${KEY}.console`, 'Erros do console')}</strong>
            <pre>{ctx.consoleErrors.map((entry) => entry.message).join('\n')}</pre>
          </div>
        )}

        <div className="CanelaBugAdmin-actions">
          <label className="CanelaBugAdmin-status">
            <span>{trans(`${KEY}.status_label`, 'Status')}</span>
            <select
              className="FormControl"
              value={report.status}
              disabled={busy}
              onchange={(e: Event) => this.save(report, { status: (e.target as HTMLSelectElement).value })}
            >
              {STATUSES.map((status) => (
                <option value={status}>{statusLabel(status)}</option>
              ))}
            </select>
          </label>

          <label className="CanelaBugAdmin-note">
            <span>{trans(`${KEY}.note_label`, 'Resposta para quem reportou')}</span>
            <textarea
              className="FormControl"
              rows={2}
              maxlength={2000}
              value={this.notes[report.id] ?? ''}
              oninput={(e: InputEvent) => (this.notes[report.id] = (e.target as HTMLTextAreaElement).value)}
            />
          </label>

          <div className="CanelaBugAdmin-buttons">
            <Button
              className="Button"
              icon="fas fa-wand-magic-sparkles"
              onclick={() => this.copy(`prompt${report.id}`, () => fetchText(apiUrl(`/canela-bug-reports/${report.id}/prompt`)).then(copyText))}
            >
              {trans(`${KEY}.copy_prompt`, 'Copiar para IA')}
            </Button>
            {this.copiedNote(`prompt${report.id}`)}
            <Button
              className="Button"
              icon="far fa-image"
              onclick={() => this.copy(`image${report.id}`, () => copyImage(apiUrl(`/canela-bug-reports/${report.id}/region`)))}
            >
              {trans(`${KEY}.copy_image`, 'Copiar captura')}
            </Button>
            {this.copiedNote(`image${report.id}`)}
          </div>

          <div className="CanelaBugAdmin-buttons">
            <Button className="Button Button--primary" loading={busy} onclick={() => this.save(report, { note: this.notes[report.id] ?? '' })}>
              {trans(`${KEY}.save_note`, 'Salvar resposta')}
            </Button>
            <Button className="Button Button--danger" icon="fas fa-trash" disabled={busy} onclick={() => this.remove(report)}>
              {trans(`${KEY}.delete`, 'Apagar')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  save(report: Report, body: Record<string, string>): void {
    this.busy.add(report.id);

    app
      .request<{ report: Report }>({ method: 'PATCH', url: apiUrl(`/canela-bug-reports/${report.id}`), body })
      .then((payload) => {
        Object.assign(report, payload.report);
        this.reload();
      })
      .catch(() => (this.error = trans(`${KEY}.save_failed`, 'Não deu para salvar. Tente de novo.')))
      .finally(() => {
        this.busy.delete(report.id);
        m.redraw();
      });
  }

  remove(report: Report): void {
    if (!confirm(trans(`${KEY}.delete_confirm`, 'Apagar este relatório e as capturas? Não dá para desfazer.'))) return;

    this.busy.add(report.id);

    app
      .request({ method: 'DELETE', url: apiUrl(`/canela-bug-reports/${report.id}`) })
      .then(() => {
        this.openId = null;
        this.reload();
      })
      .catch(() => (this.error = trans(`${KEY}.save_failed`, 'Não deu para salvar. Tente de novo.')))
      .finally(() => {
        this.busy.delete(report.id);
        m.redraw();
      });
  }
}
