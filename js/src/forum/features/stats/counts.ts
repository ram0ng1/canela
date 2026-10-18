/*
 * As contagens "Novos (N)" e "Não lidos (N)" de quem entrou na conta.
 *
 * Chegam prontas no documento do fórum (canelaNewCount / canelaUnreadCount) e
 * são renovadas por GET /api/canela-counts quando a pessoa volta à lista —
 * que é quando ela pode ter acabado de ler alguma coisa.
 *
 * Na página de uma tag, as abas mostram os números dela (`?tag=slug`), como
 * o Discourse faz na categoria: o "(1)" global numa categoria vazia mentia.
 */
import app from 'flarum/forum/app';

import { forumBool } from '../../utils/settings';
import { currentTag } from '../../utils/tags';
import { fetchTopicCounts } from './api';

/** O servidor para de contar aqui; a partir disso a aba mostra "99+". */
export const COUNT_LIMIT = 100;

/** Voltar à lista várias vezes seguidas não precisa refazer a contagem. */
const REFRESH_AFTER_MS = 15_000;

interface CountsState {
  newCount: number;
  unreadCount: number;
  /** Quando os números foram calculados no servidor (ms). */
  at: number;
}

let state: CountsState | null = null;
let refreshing: Promise<void> | null = null;

/** As contagens por tag (slug), buscadas ao abrir a página de cada uma. */
const tagged: Record<string, CountsState> = {};
const taggedRefreshing: Record<string, Promise<void> | undefined> = {};

function currentTagSlug(): string | null {
  return currentTag()?.slug() || null;
}

function toCount(value: unknown): number {
  const number = Number(value);

  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function countsEnabled(): boolean {
  return !!app.session.user && forumBool('canelaStatsCountsEnabled', true);
}

function current(): CountsState | null {
  if (!countsEnabled()) return null;

  if (!state) {
    const newCount = app.forum.attribute<unknown>('canelaNewCount');
    const unreadCount = app.forum.attribute<unknown>('canelaUnreadCount');

    // Sem os atributos (recurso desligado no servidor), não há o que mostrar.
    if (newCount === undefined && unreadCount === undefined) return null;

    state = { newCount: toCount(newCount), unreadCount: toCount(unreadCount), at: Date.now() };
  }

  return state;
}

/**
 * "Marcar tudo como lido" zera as duas na hora, sem esperar o servidor: a data
 * nova no usuário já diz que nada contado antes dela vale mais.
 */
function markedAllAfterCount(counts: CountsState): boolean {
  const markedAt = app.session.user?.markedAllAsReadAt();

  return !!markedAt && markedAt.getTime() > counts.at;
}

/**
 * As contagens que valem para `scope`: `'global'` (barra lateral) ou
 * `'page'` (as abas — a tag atual, quando a página é de uma tag).
 */
function scoped(scope: 'global' | 'page'): CountsState | null {
  const base = current();

  if (!base || scope === 'global') return base;

  const slug = currentTagSlug();

  if (!slug) return base;

  // Ainda sem o número da tag: busca e, enquanto isso, não mostra nada.
  if (!tagged[slug]) {
    refreshTag(slug);
    return null;
  }

  return tagged[slug];
}

export function newCount(scope: 'global' | 'page' = 'global'): number {
  const counts = scoped(scope);

  return counts && !markedAllAfterCount(counts) ? counts.newCount : 0;
}

export function unreadCount(scope: 'global' | 'page' = 'global'): number {
  const counts = scoped(scope);

  return counts && !markedAllAfterCount(counts) ? counts.unreadCount : 0;
}

function refreshTag(slug: string, force = false): Promise<void> {
  const counts = tagged[slug];

  if (!force && counts && Date.now() - counts.at < REFRESH_AFTER_MS && !markedAllAfterCount(counts)) return Promise.resolve();
  if (taggedRefreshing[slug]) return taggedRefreshing[slug]!;

  taggedRefreshing[slug] = fetchTopicCounts(slug)
    .then((response) => {
      if (!response) return;

      tagged[slug] = { newCount: toCount(response.new), unreadCount: toCount(response.unread), at: Date.now() };
      m.redraw();
    })
    .finally(() => {
      taggedRefreshing[slug] = undefined;
    });

  return taggedRefreshing[slug]!;
}

/** "3", ou "99+" quando o servidor parou de contar. */
export function formatCount(count: number): string {
  return count >= COUNT_LIMIT ? `${COUNT_LIMIT - 1}+` : String(count);
}

export function refreshCounts(force = false): Promise<void> {
  const counts = current();

  if (!counts) return Promise.resolve();

  const slug = currentTagSlug();
  const tagRefresh = slug ? refreshTag(slug, force) : Promise.resolve();

  return Promise.all([refreshGlobal(counts, force), tagRefresh]).then(() => {});
}

function refreshGlobal(counts: CountsState, force: boolean): Promise<void> {
  if (!force && Date.now() - counts.at < REFRESH_AFTER_MS && !markedAllAfterCount(counts)) return Promise.resolve();
  if (refreshing) return refreshing;

  refreshing = fetchTopicCounts()
    .then((response) => {
      if (!response) return;

      state = { newCount: toCount(response.new), unreadCount: toCount(response.unread), at: Date.now() };
      m.redraw();
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}
