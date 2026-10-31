/*
 * O cartão do onebox (src/Onebox): o link do GitHub sozinho numa linha vira
 * um cartão com o repositório, o caminho, a ref e as linhas do arquivo, ou o
 * título e o estado de uma issue, pull request, commit, release ou repositório.
 *
 * Fica em common/ porque o fórum desenha os cartões das postagens e o painel
 * do admin desenha a prévia ("Testar um link"). Tudo com textContent: nenhum
 * texto que veio do GitHub entra na página como HTML.
 */
import app from 'flarum/common/app';

export type OneboxType = 'file' | 'issue' | 'pull' | 'commit' | 'release' | 'repo';

export interface OneboxCard {
  type: OneboxType;
  url: string;
  repo: string;
  // arquivo
  path?: string;
  ref?: string;
  extension?: string;
  firstLine?: number;
  lines?: string[];
  highlight?: [number, number] | null;
  totalLines?: number;
  // issue, PR, commit
  number?: number;
  sha?: string;
  title?: string;
  state?: 'open' | 'closed' | 'merged' | 'draft' | 'release' | 'prerelease';
  tag?: string;
  assets?: number;
  author?: string;
  date?: string | null;
  comments?: number;
  labels?: string[];
  excerpt?: string;
  additions?: number;
  deletions?: number;
  files?: number;
  commits?: number;
  // repositório
  description?: string;
  stars?: number;
  forks?: number;
  language?: string;
  updatedAt?: string | null;
}

const KEY = 'ramon-canela.lib.onebox';

/** Os links do GitHub que podem virar cartão (o servidor confere de novo). */
export const GITHUB_URL = /^https:\/\/(www\.)?github\.com\/[^/?#\s]+\/[^/?#\s]+(\/(blob|issues|pull|commit|releases)\/[^\s]+)?\/?(#L\d+(-L?\d+)?)?$/i;

/** Os pedidos desta página, por endereço: o mesmo link em vários posts pede uma vez. */
const requests = new Map<string, Promise<OneboxCard | null>>();

export function fetchOnebox(url: string, fresh = false): Promise<OneboxCard | null> {
  let request = fresh ? undefined : requests.get(url);

  if (!request) {
    request = app
      .request<{ data: OneboxCard | null }>({
        method: 'GET',
        url: `${app.forum.attribute<string>('apiUrl')}/canela/onebox`,
        params: { url },
        // Sem cartão, fica o link: não é um erro que a pessoa precise ver.
        errorHandler: () => {},
      })
      .then((response) => (response && response.data && typeof response.data === 'object' ? response.data : null))
      .catch(() => null);

    requests.set(url, request);
  }

  return request;
}

function trans(key: string, params: Record<string, unknown> = {}): string {
  return String(app.translator.trans(`${KEY}.${key}`, params));
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string | null): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;

  return node;
}

function icon(name: string): HTMLElement {
  const node = el('i', `icon ${name}`);
  node.setAttribute('aria-hidden', 'true');

  return node;
}

function link(href: string, className: string, text: string): HTMLAnchorElement {
  const anchor = el('a', className, text);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer nofollow ugc';

  return anchor;
}

function number(value: number | undefined): string {
  try {
    return new Intl.NumberFormat(app.translator.getLocale() || undefined, { notation: 'compact' }).format(value || 0);
  } catch {
    return String(value || 0);
  }
}

function date(value: string | null | undefined): string {
  if (!value) return '';

  const parsed = new Date(value);

  if (isNaN(parsed.getTime())) return '';

  try {
    return new Intl.DateTimeFormat(app.translator.getLocale() || undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
  } catch {
    return parsed.toISOString().slice(0, 10);
  }
}

/** "github.com/dono/repo", com o ícone do GitHub. */
function source(card: OneboxCard): HTMLElement {
  const head = el('div', 'CanelaOnebox-source');
  head.appendChild(icon('fab fa-github'));
  head.appendChild(link(`https://github.com/${card.repo}`, 'CanelaOnebox-sourceLink', `github.com/${card.repo}`));

  return head;
}

function meta(items: Array<[string, string] | null>): HTMLElement {
  const row = el('div', 'CanelaOnebox-meta');

  items.forEach((item) => {
    if (!item || !item[1]) return;

    const span = el('span', 'CanelaOnebox-metaItem');
    span.appendChild(icon(item[0]));
    span.appendChild(document.createTextNode(item[1]));
    row.appendChild(span);
  });

  return row;
}

function diffStats(card: OneboxCard): HTMLElement {
  const row = el('div', 'CanelaOnebox-diff');
  row.appendChild(el('span', 'CanelaOnebox-additions', `+${card.additions || 0}`));
  row.appendChild(el('span', 'CanelaOnebox-deletions', `−${card.deletions || 0}`));

  if (card.files) row.appendChild(el('span', 'CanelaOnebox-files', trans('files', { count: card.files })));
  if (card.commits) row.appendChild(el('span', 'CanelaOnebox-commits', trans('commits', { count: card.commits })));

  return row;
}

function fileCard(card: OneboxCard, root: HTMLElement): void {
  const title = el('div', 'CanelaOnebox-title');
  title.appendChild(link(card.url, 'CanelaOnebox-titleLink CanelaOnebox-path', card.path || ''));
  root.appendChild(title);

  if (card.ref)
    root.appendChild(el('span', 'CanelaOnebox-ref', card.ref.length > 12 && /^[0-9a-f]+$/i.test(card.ref) ? card.ref.slice(0, 9) : card.ref));

  const lines = card.lines || [];
  const first = card.firstLine || 1;
  const [hlStart, hlEnd] = card.highlight || [0, -1];
  const pre = el('pre', 'CanelaOnebox-code');
  pre.setAttribute('tabindex', '0');

  lines.forEach((line, index) => {
    const lineNumber = first + index;
    const row = el('span', `CanelaOnebox-line${lineNumber >= hlStart && lineNumber <= hlEnd && card.highlight ? ' is-highlighted' : ''}`);
    row.appendChild(el('span', 'CanelaOnebox-lineNumber', String(lineNumber)));
    row.appendChild(el('code', 'CanelaOnebox-lineCode', line === '' ? ' ' : line));
    pre.appendChild(row);
  });

  root.appendChild(pre);

  const last = first + lines.length - 1;

  if (card.totalLines && (first > 1 || last < card.totalLines)) {
    root.appendChild(link(card.url, 'CanelaOnebox-more', trans('lines_of', { from: first, to: last, total: card.totalLines })));
  }
}

const PULL_ICONS: Record<string, string> = {
  open: 'fas fa-code-pull-request',
  draft: 'fas fa-code-pull-request',
  merged: 'fas fa-code-merge',
  closed: 'fas fa-code-pull-request',
};

const ISSUE_ICONS: Record<string, string> = {
  open: 'far fa-circle-dot',
  closed: 'fas fa-circle-check',
  merged: 'fas fa-circle-check',
  draft: 'far fa-circle-dot',
};

function issueCard(card: OneboxCard, root: HTMLElement): void {
  const state = card.state && card.state in ISSUE_ICONS ? card.state : 'open';
  const stateIcon = (card.type === 'pull' ? PULL_ICONS : ISSUE_ICONS)[state];

  const title = el('div', 'CanelaOnebox-title');
  const badge = el('span', `CanelaOnebox-state CanelaOnebox-state--${state}`);
  badge.appendChild(icon(stateIcon));
  badge.appendChild(document.createTextNode(trans(`state_${state}`)));
  title.appendChild(badge);
  // O número segue a última palavra do título, mesmo quando ele quebra a linha.
  const text = el('span', 'CanelaOnebox-titleText');
  text.appendChild(link(card.url, 'CanelaOnebox-titleLink', card.title || ''));
  text.appendChild(document.createTextNode(' '));
  text.appendChild(el('span', 'CanelaOnebox-number', `#${card.number}`));
  title.appendChild(text);
  root.appendChild(title);

  if (card.labels?.length) {
    const labels = el('div', 'CanelaOnebox-labels');
    card.labels.forEach((label) => labels.appendChild(el('span', 'CanelaOnebox-label', label)));
    root.appendChild(labels);
  }

  if (card.excerpt) root.appendChild(el('p', 'CanelaOnebox-excerpt', card.excerpt));

  root.appendChild(
    meta([
      ['far fa-user', card.author || ''],
      ['far fa-calendar', date(card.date)],
      card.comments ? ['far fa-comment', trans('comments', { count: card.comments })] : null,
    ])
  );

  if (card.type === 'pull') root.appendChild(diffStats(card));
}

function commitCard(card: OneboxCard, root: HTMLElement): void {
  const title = el('div', 'CanelaOnebox-title');
  title.appendChild(link(card.url, 'CanelaOnebox-titleLink', card.title || ''));
  root.appendChild(title);
  root.appendChild(el('span', 'CanelaOnebox-ref', (card.sha || '').slice(0, 9)));

  if (card.excerpt) root.appendChild(el('p', 'CanelaOnebox-excerpt', card.excerpt));

  root.appendChild(
    meta([
      ['far fa-user', card.author || ''],
      ['far fa-calendar', date(card.date)],
    ])
  );
  root.appendChild(diffStats(card));
}

function releaseCard(card: OneboxCard, root: HTMLElement): void {
  const state = card.state === 'prerelease' ? 'prerelease' : 'release';
  const title = el('div', 'CanelaOnebox-title');
  const badge = el('span', `CanelaOnebox-state CanelaOnebox-state--${state}`);
  badge.appendChild(icon('fas fa-tag'));
  badge.appendChild(document.createTextNode(trans(`state_${state}`)));
  title.appendChild(badge);
  title.appendChild(link(card.url, 'CanelaOnebox-titleLink', card.title || card.tag || ''));
  root.appendChild(title);

  if (card.tag && card.tag !== card.title) root.appendChild(el('span', 'CanelaOnebox-ref', card.tag));
  if (card.excerpt) root.appendChild(el('p', 'CanelaOnebox-excerpt', card.excerpt));

  root.appendChild(
    meta([
      ['far fa-user', card.author || ''],
      ['far fa-calendar', date(card.date)],
      card.assets ? ['fas fa-box-archive', trans('assets', { count: card.assets })] : null,
    ])
  );
}

function repoCard(card: OneboxCard, root: HTMLElement): void {
  const title = el('div', 'CanelaOnebox-title');
  title.appendChild(link(card.url, 'CanelaOnebox-titleLink', card.repo));
  root.appendChild(title);

  if (card.description) root.appendChild(el('p', 'CanelaOnebox-excerpt', card.description));

  root.appendChild(
    meta([
      ['fas fa-code', card.language || ''],
      ['far fa-star', number(card.stars)],
      ['fas fa-code-fork', number(card.forks)],
      ['far fa-clock', date(card.updatedAt)],
    ])
  );
}

/** O cartão pronto, para pôr na página. */
export function renderOneboxCard(card: OneboxCard): HTMLElement {
  const root = el('aside', `CanelaOnebox CanelaOnebox--github CanelaOnebox--${card.type}`);
  root.setAttribute('contenteditable', 'false');
  root.appendChild(source(card));

  if (card.type === 'file') fileCard(card, root);
  else if (card.type === 'issue' || card.type === 'pull') issueCard(card, root);
  else if (card.type === 'commit') commitCard(card, root);
  else if (card.type === 'release') releaseCard(card, root);
  else repoCard(card, root);

  return root;
}
