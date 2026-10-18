/*
 * A rota da página de busca e o endereço dela. Fora da SearchPage para a
 * página ir num chunk próprio: o link do modal só precisa da URL.
 */
import app from 'flarum/forum/app';

import { forumBool } from '../../../utils/settings';
import type { SearchTab } from './sources';

export const SEARCH_ROUTE = 'canela.search';

export function searchPageEnabled(): boolean {
  return forumBool('canelaSearchPageEnabled', true);
}

/** URL da página de busca — usada pelo link do modal e por quem mais quiser. */
export function searchUrl(q: string, type?: SearchTab, sort?: string): string {
  const params: Record<string, string> = {};

  if (q) params.q = q;
  if (type && type !== 'topics') params.type = type;
  if (sort && sort !== 'relevance') params.sort = sort;

  return app.route(SEARCH_ROUTE, params);
}
