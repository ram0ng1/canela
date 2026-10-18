/*
 * A consulta da página de busca, nos dois sentidos:
 *
 *   "horizon autor:ana tag:suporte é:trancada"  <->  { text, author, category, … }
 *
 * Como no Discourse, os filtros avançados não ficam num estado à parte: eles
 * ESCREVEM gambits na própria consulta, que vai para a URL. Assim a busca pode
 * ser compartilhada por link, o campo mostra exatamente o que está sendo
 * pesquisado, e quem digita os gambits à mão vê os controles se ajustarem.
 *
 * A leitura usa o GambitManager do core (as palavras-chave são traduzidas, e
 * os gambits de outras extensões também são reconhecidos). Filtros que a
 * página não conhece ficam em `extra` e voltam intactos para a consulta.
 */
import app from 'flarum/forum/app';
import type IGambit from 'flarum/common/query/IGambit';

import { allTags, type CanelaTag } from '../../../utils/tags';

export type SearchStatus = '' | 'open' | 'closed' | 'sticky';

export interface SearchQuery {
  /** O texto livre, sem os gambits. */
  text: string;
  author: string;
  category: string;
  tags: string[];
  inTitle: boolean;
  liked: boolean;
  bookmarked: boolean;
  unread: boolean;
  status: SearchStatus;
  /** YYYY-MM-DD */
  after: string;
  before: string;
  minPosts: string;
  /** Filtros de outras extensões (ou digitados à mão) que a página não edita. */
  extra: Record<string, unknown>;
}

/** Limites do `created:` quando só uma das pontas foi escolhida. */
const OPEN_START = '1970-01-01';
const OPEN_END = '2999-12-31';

const KNOWN_KEYS = [
  'q',
  'author',
  'tag',
  'canelaInTitle',
  'canelaLiked',
  'canelaBookmarked',
  'unread',
  'locked',
  '-locked',
  'sticky',
  'created',
  'canelaMinPosts',
];

export function emptyQuery(): SearchQuery {
  return {
    text: '',
    author: '',
    category: '',
    tags: [],
    inTitle: false,
    liked: false,
    bookmarked: false,
    unread: false,
    status: '',
    after: '',
    before: '',
    minPosts: '',
    extra: {},
  };
}

function findTag(slug: string): CanelaTag | undefined {
  const wanted = slug.toLowerCase();

  return allTags().find((tag) => tag.slug().toLowerCase() === wanted);
}

/** Categoria = tag primária (com posição) ou filha de uma. */
export function isCategory(tag: CanelaTag): boolean {
  return tag.position() !== null || tag.isChild();
}

export function parseQuery(raw: string): SearchQuery {
  const query = emptyQuery();
  const filter = app.search.gambits.apply('discussions', { q: raw || '' }) as Record<string, any>;

  query.text = String(filter.q || '').trim();
  query.author = typeof filter.author === 'string' ? filter.author : '';
  query.inTitle = !!filter.canelaInTitle;
  query.liked = !!filter.canelaLiked;
  query.bookmarked = !!filter.canelaBookmarked;
  query.unread = !!filter.unread;
  query.minPosts = filter.canelaMinPosts ? String(filter.canelaMinPosts) : '';

  if (filter['-locked']) query.status = 'open';
  else if (filter.locked) query.status = 'closed';
  else if (filter.sticky) query.status = 'sticky';

  // `tag:a tag:b` chega como ['a', 'b'] (E); `tag:a,b` como ['a,b'] (OU). Só
  // os simples viram categoria/etiquetas; um OU fica como foi digitado.
  const tagValues: string[] = Array.isArray(filter.tag) ? filter.tag : filter.tag ? [String(filter.tag)] : [];
  const orGroups: string[] = [];

  for (const value of tagValues) {
    if (value.includes(',')) {
      orGroups.push(value);
      continue;
    }

    const tag = findTag(value);

    if (tag && isCategory(tag) && !query.category) query.category = tag.slug();
    else query.tags.push(tag ? tag.slug() : value);
  }

  if (typeof filter.created === 'string') {
    const [start, end] = filter.created.split('..');

    if (end === undefined) {
      query.after = start;
      query.before = start;
    } else {
      query.after = start === OPEN_START ? '' : start;
      query.before = end === OPEN_END ? '' : end;
    }
  }

  for (const key of Object.keys(filter)) {
    if (!KNOWN_KEYS.includes(key)) query.extra[key] = filter[key];
  }

  if (orGroups.length) query.extra.tag = orGroups;

  return query;
}

/** Os filtros da API equivalentes à consulta (sem o texto livre). */
export function queryFilters(query: SearchQuery): Record<string, any> {
  const filter: Record<string, any> = { ...query.extra };
  const tags = [query.category, ...query.tags].filter(Boolean);
  const extraTags = Array.isArray(filter.tag) ? filter.tag : [];

  if (tags.length || extraTags.length) filter.tag = [...tags, ...extraTags];
  if (query.author.trim()) filter.author = query.author.trim();
  if (query.inTitle) filter.canelaInTitle = true;
  if (query.liked) filter.canelaLiked = true;
  if (query.bookmarked) filter.canelaBookmarked = true;
  if (query.unread) filter.unread = true;
  if (query.status === 'open') filter['-locked'] = true;
  if (query.status === 'closed') filter.locked = true;
  if (query.status === 'sticky') filter.sticky = true;

  const minPosts = parseInt(query.minPosts, 10);
  if (Number.isFinite(minPosts) && minPosts > 0) filter.canelaMinPosts = String(minPosts);

  if (query.after || query.before) {
    filter.created = query.after && query.after === query.before ? query.after : `${query.after || OPEN_START}..${query.before || OPEN_END}`;
  }

  return filter;
}

/**
 * A consulta como texto, com os gambits traduzidos.
 *
 * Não usa `GambitManager.from`: ele perde o "-" de um filtro negado (o
 * `-é:trancada` dos tópicos abertos) quando há mais de um gambit registrado.
 */
export function serializeQuery(query: SearchQuery): string {
  const gambits = app.search.gambits.for('discussions');
  const filter = queryFilters(query);
  const parts: string[] = query.text ? [query.text] : [];

  for (const [rawKey, value] of Object.entries(filter)) {
    const negate = rawKey.startsWith('-');
    const key = negate ? rawKey.slice(1) : rawKey;
    const gambit = gambits.find((candidate: IGambit) => candidate.filterKey() === key);

    if (!gambit) continue;

    // Tags em E viram um `tag:` por valor; o TagGambit já faz isso com arrays.
    parts.push(gambit.fromFilter(value, negate));
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Há algo para pesquisar? Só filtros também vale, como no Discourse. */
export function hasCriteria(query: SearchQuery): boolean {
  return !!query.text || Object.keys(queryFilters(query)).length > 0;
}

/** As palavras do texto livre, para destacar nos resultados. */
export function highlightPattern(text: string): RegExp | undefined {
  const words = text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  return words.length ? new RegExp(words.join('|'), 'gi') : undefined;
}
