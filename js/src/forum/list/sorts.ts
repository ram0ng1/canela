/*
 * As abas "Em alta" e "Não lidos" do Discourse viram ordenações do
 * DiscussionListState. Assim elas aparecem na URL (`?sort=hot`), passam pelo
 * mesmo `changeSort` das outras e funcionam em qualquer página que filtre a
 * lista (tag, seguindo…) sem código à parte.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type { SortMap } from 'flarum/common/states/PaginatedListState';

import { forumBool, forumInt, t } from '../utils/settings';
import { lastDaysRange } from '../utils/dates';

export const HOT_SORT = 'hot';
export const UNREAD_SORT = 'unread';

/** As ordenações do core — o que sobra no sortMap veio de extensões. */
export const CORE_SORTS = ['relevance', 'latest', 'top', 'newest', 'oldest', 'az', 'za'];

function extraSorts(): SortMap {
  const extra: SortMap = {};

  if (forumBool('canelaNavHot', true)) {
    // "Em alta" é a mais comentada entre as criadas nos últimos dias; o
    // filtro de data entra em requestParams.
    extra[HOT_SORT] = { sort: '-commentCount', label: t('nav.hot') };
  }

  if (app.session.user && forumBool('canelaNavUnread', true)) {
    // O core já tem o filtro `unread`; a ordem é a mesma de "Recentes".
    extra[UNREAD_SORT] = { sort: '-lastPostedAt', label: t('nav.unread') };
  }

  return extra;
}

export default function installSorts(): void {
  extend(DiscussionListState.prototype, 'sortMap', function (map: SortMap) {
    const extra = extraSorts();

    if (!Object.keys(extra).length) return;

    // Reconstrói o objeto para encaixar as novas logo depois de "Recentes":
    // a primeira chave é a ordenação padrão da página (defaultSort), e a
    // ordem das chaves é a ordem das abas.
    const entries = Object.entries(map);

    Object.keys(map).forEach((key) => delete map[key]);

    for (const [key, value] of entries) {
      map[key] = value;

      if (key === 'latest') Object.assign(map, extra);
    }

    // Sem "latest" (uma extensão pode tê-lo tirado), elas vão para o fim.
    for (const [key, value] of Object.entries(extra)) {
      if (!(key in map)) map[key] = value;
    }
  });

  extend(DiscussionListState.prototype, 'requestParams', function (this: DiscussionListState, params) {
    const sort = this.getParams().sort;

    if (sort === HOT_SORT && sort in this.sortMap()) {
      params.filter = { ...params.filter, created: lastDaysRange(forumInt('canelaHotDays', 7)) };
    }

    // Com as contagens do servidor (recurso stats), as abas Novos e Não lidos
    // listam pela mesma regra do "(N)": nunca aberto / aberto com respostas
    // novas, como no Discourse. Sem elas, vale o filtro `unread` do core.
    const personal = !!app.session.user && forumBool('canelaStatsCountsEnabled', false) && app.forum.attribute('canelaUnreadCount') !== undefined;

    if (sort === UNREAD_SORT && sort in this.sortMap()) {
      params.filter = { ...params.filter, ...(personal ? { canelaUnread: '1' } : { unread: '1' }) };
    }

    if (sort === 'newest' && personal) {
      params.filter = { ...params.filter, canelaNew: '1' };
    }
  });
}

/** O rótulo de uma ordenação como o core monta no dropdown dele. */
export function sortLabel(key: string): string {
  const sort = app.discussions.sortMap()[key];

  if (sort && typeof sort !== 'string') return sort.label as string;

  switch (key) {
    case 'latest':
      return t('nav.latest');
    case 'newest':
      return t('nav.newest');
    case 'top':
      return t('nav.top');
    default:
      return app.translator.trans(`core.forum.index_sort.${key}_button`, {}, true) as string;
  }
}

export function activeSort(): string {
  return app.search.state.params().sort || app.search.state.defaultSort();
}
