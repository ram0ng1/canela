/*
 * As listas do menu do usuário prontas antes do clique.
 *
 * O NotificationsDropdown do core só busca a lista ao abrir, e o `load()` dos
 * estados (notificações, conversas, denúncias) esvazia o que já tinha quando
 * chega algo novo — o menu reabria com o esqueleto no lugar dos itens. Aqui:
 *
 * - a primeira busca sai antes de o menu abrir: quando a página fica ociosa
 *   (as notificações, a aba padrão) e ao apontar, focar ou tocar o avatar
 *   (todas as abas);
 * - depois, quando o core esvaziaria a lista, ela é revalidada
 *   (`PaginatedListState::revalidate()`): os itens continuam na tela e são
 *   trocados quando a resposta chega.
 *
 * Fica no bundle principal (o menu aberto vem num chunk): só usa os estados
 * do core e das extensões.
 */
import app from 'flarum/forum/app';

type ListState = {
  getPages(): unknown[];
  isLoading(): boolean;
  load(): Promise<void>;
  revalidate?(): Promise<void>;
};

const swallow = () => {};

/** O estado, se existir e tiver a cara de um PaginatedListState. */
function listState(name: 'notifications' | 'dialogs' | 'flags'): ListState | null {
  const state = (app as any)[name];

  return state && typeof state.getPages === 'function' && typeof state.load === 'function' ? state : null;
}

/**
 * A primeira busca, ou — com a lista já na tela e algo novo (`changed`) — a
 * revalidação, sem esvaziar.
 */
function freshen(state: ListState, changed: boolean, beforeRevalidate: () => void): Promise<void> {
  if (!state.getPages().length) {
    return state.isLoading() ? Promise.resolve() : Promise.resolve(state.load()).catch(swallow);
  }

  if (!changed) return Promise.resolve();

  beforeRevalidate();

  // Um core sem o revalidate(): o load() de antes, que esvazia.
  return Promise.resolve(state.revalidate ? state.revalidate() : state.load()).catch(swallow);
}

export function warmNotifications(): Promise<void> {
  const user = app.session.user;
  const state = listState('notifications');

  if (!user || !state) return Promise.resolve();

  // Como o load() do core: buscar a lista zera o contador de novas (a API
  // marca as notificações como vistas).
  return freshen(state, !!user.newNotificationCount(), () => user.pushAttributes({ newNotificationCount: 0 }));
}

export function warmDialogs(): Promise<void> {
  const user = app.session.user;
  const state: any = listState('dialogs');

  if (!user || !state) return Promise.resolve();

  // O DialogListState recarrega quando o número de não lidas muda.
  const count = user.attribute<number>('unreadDialogCount') || 0;

  return freshen(state, count !== state.lastCount, () => (state.lastCount = count));
}

export function warmFlags(): Promise<void> {
  const user = app.session.user;
  const state = listState('flags');

  if (!user || !state || !app.forum.attribute('canViewFlags')) return Promise.resolve();

  // A API marca a fila como vista (`read_flags_at`): a bandeira do avatar sai.
  return freshen(state, !!user.attribute<number>('newFlagCount'), swallow).then(() => {
    user.pushAttributes({ newFlagCount: 0 });
  });
}

/** Os marcadores do menu: guardados entre aberturas, revalidados a cada uma. */
export const bookmarks: { items: any[]; loaded: boolean; pending: Promise<void> | null } = {
  items: [],
  loaded: false,
  pending: null,
};

/** A primeira busca; com `refresh`, também a revalidação (ao abrir o menu). */
export function warmBookmarks(refresh = false): Promise<void> {
  if (!app.session.user || !app.forum.attribute('canelaBookmarksEnabled')) return Promise.resolve();
  if (bookmarks.pending) return bookmarks.pending;
  if (bookmarks.loaded && !refresh) return Promise.resolve();

  bookmarks.pending = app.store
    .find<any[]>('canela-bookmarks', { include: 'post,post.discussion,post.user', page: { limit: 20 } } as any)
    .then((results: any) => {
      bookmarks.items = Array.isArray(results) ? results.slice() : [];
    })
    .catch(swallow)
    .finally(() => {
      bookmarks.loaded = true;
      bookmarks.pending = null;
      m.redraw();
    });

  return bookmarks.pending;
}

/**
 * Todas as abas: ao apontar o avatar e ao abrir o menu (`refresh`). As listas
 * dos estados só buscam de novo quando há algo novo; os marcadores, que não
 * têm contador, a cada abertura.
 */
export function warmMenu(refresh = false): void {
  void warmNotifications().then(() => m.redraw());
  void warmDialogs().then(() => m.redraw());
  void warmFlags().then(() => m.redraw());
  void warmBookmarks(refresh);
}

let scheduled = false;

/**
 * A aba padrão — e o que `also` pedir (o chunk do menu aberto) —, uma vez por
 * sessão, quando a página fica ociosa.
 */
export function warmWhenIdle(also?: () => void): void {
  if (scheduled || !app.session.user) return;

  scheduled = true;

  const run = () => {
    also?.();
    void warmNotifications().then(() => m.redraw());
  };
  const idle = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;

  if (idle) idle(run, { timeout: 3000 });
  else window.setTimeout(run, 1500);
}
