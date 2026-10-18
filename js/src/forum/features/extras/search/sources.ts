/*
 * Uma fonte de resultados por aba da página de busca. Cada uma sabe montar o
 * pedido à API a partir da consulta e da ordenação escolhida.
 */
import app from 'flarum/forum/app';
import type Model from 'flarum/common/Model';

import { isExtensionEnabled } from '../../../utils/settings';
import { allTags, isTagsEnabled } from '../../../utils/tags';
import { queryFilters, type SearchQuery } from './query';

export type SearchTab = 'topics' | 'posts' | 'categories' | 'users';

export const PAGE_SIZE = 20;

export interface SortOption {
  key: string;
  /** O valor do `sort` da API; vazio = relevância (a ordem do texto). */
  api: string;
  label: string;
}

export interface SearchPage {
  items: Model[];
  total: number | null;
  hasMore: boolean;
}

/** As visualizações vêm do recurso de estatísticas do tema, quando ele está ligado. */
function viewsSortable(): boolean {
  return app.forum.attribute('canelaStatsViewsEnabled') === true;
}

export function sortOptions(tab: SearchTab, t: (key: string) => string): SortOption[] {
  const likes = isExtensionEnabled('flarum-likes');

  if (tab === 'topics') {
    return [
      { key: 'relevance', api: '', label: t('extras.search.sort_relevance') },
      { key: 'latest', api: '-lastPostedAt', label: t('extras.search.sort_latest_post') },
      { key: 'newest', api: '-createdAt', label: t('extras.search.sort_latest_topic') },
      ...(likes ? [{ key: 'likes', api: '-canelaLikes', label: t('extras.search.sort_likes') }] : []),
      ...(viewsSortable() ? [{ key: 'views', api: '-viewCount', label: t('extras.search.sort_views') }] : []),
    ];
  }

  if (tab === 'posts') {
    return [
      { key: 'relevance', api: '', label: t('extras.search.sort_relevance') },
      { key: 'latest', api: '-createdAt', label: t('extras.search.sort_latest_post') },
      ...(likes ? [{ key: 'likes', api: '-canelaLikes', label: t('extras.search.sort_likes') }] : []),
    ];
  }

  return [];
}

/** Os filtros que a busca de POSTAGENS entende: autor, tags, curtidas e marcadores. */
export function postFilters(query: SearchQuery): { filter: Record<string, any>; ignored: boolean } {
  const all = queryFilters(query);
  const filter: Record<string, any> = { type: 'comment' };

  if (all.author) filter.author = all.author;
  // O filtro de tags das postagens (flarum/tags) recebe ids, não slugs, e
  // junta a tabela de tags: uma tag só, ou a mesma postagem viria repetida.
  // Vale a categoria, ou a única etiqueta; mais que isso fica de fora.
  const slugs = [query.category, ...query.tags].filter(Boolean);
  const tag = isTagsEnabled() && slugs.length ? allTags().find((item) => item.slug() === slugs[0]) : undefined;
  if (tag) filter.tag = tag.id();
  const tagsIgnored = slugs.length > 1 || (slugs.length === 1 && !tag) || 'tag' in query.extra;

  // O flarum/likes filtra postagens por quem curtiu (nome de usuário).
  if (query.liked && app.session.user) filter.likedBy = app.session.user.username();
  if (query.bookmarked) filter.canelaBookmarked = true;

  const handled = ['author', 'tag', 'canelaLiked', 'canelaBookmarked'];
  const ignored = tagsIgnored || Object.keys(all).some((key) => !handled.includes(key));

  return { filter, ignored };
}

function pageOf(response: any, items: Model[]): SearchPage {
  const total = response?.payload?.meta?.page?.total;

  return {
    items,
    total: typeof total === 'number' ? total : null,
    hasMore: !!response?.payload?.links?.next,
  };
}

export async function fetchPage(tab: SearchTab, query: SearchQuery, sort: string, offset: number): Promise<SearchPage> {
  const page = { offset, limit: PAGE_SIZE };

  if (tab === 'topics') {
    const include = ['user', 'lastPostedUser', 'firstPost', 'mostRelevantPost', 'mostRelevantPost.user'];
    if (isTagsEnabled()) include.push('tags');

    const filter: Record<string, any> = queryFilters(query);
    if (query.text) filter.q = query.text;

    const response: any = await app.store.find('discussions', { filter, sort: sort || undefined, include: include.join(','), page });

    return pageOf(response, response);
  }

  if (tab === 'posts') {
    const { filter } = postFilters(query);
    if (query.text) filter.q = query.text;

    const include = ['user', 'discussion'];
    if (isTagsEnabled()) include.push('discussion.tags');

    const response: any = await app.store.find('posts', { filter, sort: sort || undefined, include: include.join(','), page });

    return pageOf(response, response);
  }

  if (tab === 'categories') {
    const response: any = await app.store.find('tags', { filter: { q: query.text }, include: 'parent', page });

    return pageOf(response, response);
  }

  const response: any = await app.store.find('users', { filter: { q: query.text }, page });

  return pageOf(response, response);
}
