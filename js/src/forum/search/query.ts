/*
 * O que o menu de busca precisa saber fora do desenho: como o termo digitado
 * (com `#categoria` e `@usuário`) vira uma consulta
 * do Flarum e para onde vai a busca de página inteira. As buscas recentes,
 * as dicas e os atalhos do assistente moram em assist.ts (chunk do painel).
 */
import app from 'flarum/forum/app';
import { GambitType } from 'flarum/common/query/IGambit';

import { forumBool } from '../utils/settings';

/** `#slug` no fim do termo: o assistente lista categorias e etiquetas. */
export const CATEGORY_SLUG_REGEXP = /(#[\p{L}\p{N}\-_:]*)$/u;
/** `@nome` no fim do termo: o assistente lista usuários. */
export const USERNAME_REGEXP = /(@[\p{L}\p{N}\-_.]*)$/u;
/** `algo:` no fim do termo: o assistente lista os filtros (gambits). */
export const SUGGESTIONS_REGEXP = /(\S*:)([\p{L}\p{N}\-]*)$/u;
/** O termo já tem um modificador: a primeira linha não repete "em todos os tópicos". */
export const MODIFIER_REGEXP = /[#@:]/;

const SEARCH_ROUTE = 'canela.search';

/** A chave traduzida de um gambit do core ou de uma extensão, pelo filtro que ele gera. */
export function gambitKey(filterKey: string): string | null {
  const gambit = app.search.gambits.for('discussions').find((g) => g.filterKey() === filterKey && g.enabled());

  if (!gambit || gambit.type !== GambitType.KeyValue) return null;

  const key = (gambit as any).key();

  return Array.isArray(key) ? key[0] : key;
}

/**
 * "tema #suporte @ana" -> "tema tag:suporte autor:ana": o Flarum não
 * conhece esses atalhos, mas conhece os gambits (com as chaves no
 * idioma do fórum), que a busca do core e a página de busca já entendem.
 */
export function toGambitQuery(term: string): string {
  const tagKey = gambitKey('tag');
  const authorKey = gambitKey('author');

  return term
    .split(/\s+/)
    .filter(Boolean)
    .map((bit) => {
      if (tagKey && /^#[^\s#]+$/.test(bit)) return `${tagKey}:${bit.slice(1).split(':').pop()}`;
      if (authorKey && /^@[^\s@]+$/.test(bit)) return `${authorKey}:${bit.slice(1)}`;

      return bit;
    })
    .join(' ');
}

/** O filtro da API para o termo, e o texto livre que sobra (o que se destaca nos resultados). */
export function discussionFilter(term: string): { filter: Record<string, any>; text: string } {
  const filter = app.search.gambits.apply('discussions', { q: toGambitQuery(term) }) as Record<string, any>;
  const text = String(filter.q || '').trim();

  if (!text) delete filter.q;

  return { filter, text };
}

function searchPageAvailable(): boolean {
  return forumBool('canelaSearchPageEnabled', true) && SEARCH_ROUTE in (app.routes as Record<string, unknown>);
}

/** A busca de página inteira: a página de busca do tema ou, sem ela, a lista do core com `?q=`. */
export function fullSearchUrl(term: string): string {
  const q = toGambitQuery(term.trim());

  if (searchPageAvailable()) return app.route(SEARCH_ROUTE, q ? { q } : {});

  const filter = app.search.gambits.apply('discussions', { q }) as Record<string, any>;
  const text = filter.q || null;

  delete filter.q;

  return app.route('index', { q: text, filter });
}

/** O botão dos controles deslizantes só existe com a página de busca avançada. */
export function advancedSearchAvailable(): boolean {
  return searchPageAvailable();
}
