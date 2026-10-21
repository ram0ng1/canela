/*
 * A linha "último acesso" da lista:
 * na lista de Recentes, uma linha vermelha separa os tópicos que se mexeram
 * desde a visita anterior dos que já estavam assim.
 *
 * O Flarum não guarda a visita anterior (o last_seen_at é atualizado a cada
 * requisição), então o tema guarda no aparelho, por usuário: a visita atual
 * e a anterior. Uma "visita" nova começa depois de uma hora sem uso.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import IndexPage from 'flarum/forum/components/IndexPage';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { gaps } from '../settings';
import { t } from '../../utils/settings';

const VISIT_GAP_MS = 60 * 60 * 1000;
const KEY = 'canela.visits.';

interface Visits {
  /** Última vez que o leitor usou o fórum (atualizada enquanto ele usa). */
  last: number;
  /** Quando terminou a visita anterior: o corte da linha. */
  previous: number;
}

function storageKey(): string | null {
  const user = app.session.user;

  return user ? KEY + user.id() : null;
}

function read(): Visits | null {
  const key = storageKey();

  if (!key) return null;

  try {
    const data = JSON.parse(localStorage.getItem(key) || 'null');

    return data && typeof data.last === 'number' && typeof data.previous === 'number' ? data : null;
  } catch {
    return null;
  }
}

function write(visits: Visits): void {
  const key = storageKey();

  if (!key) return;

  try {
    localStorage.setItem(key, JSON.stringify(visits));
  } catch {
    // Sem localStorage (janela privada): a linha simplesmente não aparece.
  }
}

/** Marca uso agora; se o leitor esteve fora mais de uma hora, começa visita nova. */
export function touchVisit(): void {
  if (!app.session.user) return;

  const now = Date.now();
  const visits = read();

  if (!visits) {
    write({ last: now, previous: now });
    return;
  }

  write({ last: now, previous: now - visits.last > VISIT_GAP_MS ? visits.last : visits.previous });
}

export function previousVisit(): Date | null {
  const visits = read();

  return visits && visits.previous < visits.last ? new Date(visits.previous) : null;
}

/** Só na lista de Recentes da página inicial (ou de uma tag), sem busca. */
function appliesTo(state: any): boolean {
  if (!gaps.lastVisit() || !app.session.user || state !== app.discussions || !app.current.matches(IndexPage)) return false;

  const params = state.getParams?.() || {};
  const sort = params.sort;

  return !params.q && (!sort || sort === 'latest');
}

function isPinned(discussion: Discussion): boolean {
  return !!discussion.attribute<boolean>('isSticky');
}

export default function installLastVisit(): void {
  extend(app as any, 'mount', () => {
    touchVisit();

    // Uma aba que ficou aberta a noite toda: voltar a ela conta como visita nova.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') touchVisit();
    });
  });

  extend(IndexPage.prototype, 'oninit', () => touchVisit());

  extend(DiscussionList.prototype, 'view', function (this: any, vdom: Mithril.Vnode<any, any>) {
    const state = this.attrs.state;

    if (!vdom || !appliesTo(state)) return;

    const since = previousVisit();

    if (!since) return;

    const list = (Array.isArray(vdom.children) ? vdom.children : []).find(
      (child: any) => child && child.attrs && String(child.attrs.className || '').includes('DiscussionList-discussions')
    ) as any;

    if (!list || !Array.isArray(list.children)) return;

    let seenNewer = false;

    // Cada página da lista é um fragmento ('['), com os <li> (que têm key) dentro.
    for (const page of list.children) {
      const rows: any[] = page && page.tag === '[' && Array.isArray(page.children) ? page.children : [];

      for (let index = 0; index < rows.length; index++) {
        const id = rows[index]?.attrs?.['data-id'];
        const discussion = id ? app.store.getById<Discussion>('discussions', String(id)) : null;

        if (!discussion || isPinned(discussion)) continue;

        const bumped = discussion.lastPostedAt() || discussion.createdAt();

        if (bumped && bumped > since) {
          seenNewer = true;
          continue;
        }

        // Se nem o primeiro tópico é novo, a linha no topo não diz nada.
        if (!seenNewer) return;

        rows.splice(
          index,
          0,
          <li key="canela-last-visit" className="CanelaLastVisit" role="separator">
            <span className="CanelaLastVisit-label">{t('gaps.last_visit')}</span>
          </li>
        );

        return;
      }
    }
  });
}
