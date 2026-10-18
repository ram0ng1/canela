/*
 * Pré-carregamento da primeira carga (recurso `preload` no servidor).
 *
 * O core já entrega no HTML o `apiDocument` da rota; o tema acrescenta, em
 * `payload.canelaPreload`, as respostas dos pedidos que as próprias páginas
 * fariam logo depois do boot (Resumo do perfil, lista de notificações, Sobre,
 * contagens de uma tag). Cada uma tem por chave o caminho na API e os
 * parâmetros achatados e ordenados — a mesma conta de
 * `src/Preload/PreloadKey.php`.
 *
 * Em vez de mexer em cada página, `app.store.find` e `app.request` (GET)
 * olham aqui antes de ir à rede: se a chave bate, a resposta pronta é usada
 * uma única vez. Fora disso (navegação dentro do app, outros parâmetros,
 * depois de MAX_AGE_MS) o pedido segue normal.
 */
import app from 'flarum/forum/app';
import Store from 'flarum/common/Store';
import { override } from 'flarum/common/extend';

/** Depois disso o dado pré-carregado já pode estar velho: a página pede de novo. */
const MAX_AGE_MS = 30_000;

let entries: Record<string, unknown> | null = null;
let bootedAt = 0;

function flatten(value: unknown, prefix: string, pairs: string[]): void {
  if (value === undefined || value === null) return;

  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      flatten(item, prefix ? `${prefix}[${key}]` : key, pairs);
    }

    return;
  }

  // O Mithril também deixa de fora o valor vazio (`page[limit]` sem número).
  if (value === '') return;

  pairs.push(`${prefix}=${String(value)}`);
}

/** `caminho?a=1&b[c]=2`, sem codificação e em ordem alfabética. */
export function preloadKey(path: string, params: Record<string, unknown> = {}, extraPairs: string[] = []): string {
  const pairs = [...extraPairs];
  flatten(params, '', pairs);
  pairs.sort();

  return `${path.replace(/^\/+|\/+$/g, '')}?${pairs.join('&')}`;
}

/** A resposta pré-carregada desse pedido, uma vez só; null se não houver. */
export function takePreloaded<T = any>(path: string, params: Record<string, unknown> = {}, extraPairs: string[] = []): T | null {
  if (!entries) return null;

  if (Date.now() - bootedAt > MAX_AGE_MS) {
    entries = null;
    return null;
  }

  const key = preloadKey(path, params, extraPairs);

  if (!Object.prototype.hasOwnProperty.call(entries, key)) return null;

  const data = entries[key] as T;
  delete entries[key];

  return data;
}

/** O caminho relativo à API (`canela-about`) e os pares da query, ou null se a URL não é da API. */
function apiPath(url: string): { path: string; pairs: string[] } | null {
  try {
    const target = new URL(url, window.location.href);
    const base = new URL(String(app.forum.attribute('apiUrl') || '/api'), window.location.href);
    const basePath = base.pathname.replace(/\/+$/, '');

    if (target.origin !== base.origin || !target.pathname.startsWith(basePath + '/')) return null;

    const pairs: string[] = [];
    target.searchParams.forEach((value, key) => {
      if (value !== '') pairs.push(`${key}=${value}`);
    });

    return { path: target.pathname.slice(basePath.length + 1), pairs };
  } catch {
    return null;
  }
}

export default function installPreload(): void {
  const data = (app.data as any)?.canelaPreload;

  // Sem nada pré-carregado (a maioria das rotas), nada a interceptar.
  if (!data || typeof data !== 'object') return;

  entries = data;
  bootedAt = Date.now();

  override(
    Store.prototype,
    'find',
    function (this: Store, original: (...args: any[]) => any, type: string, idOrParams?: any, query: any = {}, options: any = {}) {
      // Uma lista de ids vira `filter[id]` lá dentro: esse formato o servidor não pré-carrega.
      if (entries && !Array.isArray(idOrParams)) {
        const single = typeof idOrParams === 'string' || typeof idOrParams === 'number';
        const preloaded = takePreloaded(single ? `${type}/${idOrParams}` : type, single ? query : idOrParams || {});

        if (preloaded) return Promise.resolve(this.pushPayload(preloaded as any));
      }

      return original(type, idOrParams, query, options);
    }
  );

  override(app, 'request', function (original: (...args: any[]) => any, options: any, ...rest: any[]) {
    if (entries && options && typeof options.url === 'string' && String(options.method || 'GET').toUpperCase() === 'GET') {
      const target = apiPath(options.url);
      const preloaded = target && takePreloaded(target.path, options.params || {}, target.pairs);

      if (preloaded) return Promise.resolve(preloaded);
    }

    return original(options, ...rest);
  });
}
