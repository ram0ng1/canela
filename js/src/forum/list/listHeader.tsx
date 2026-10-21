/*
 * Cabeçalho de colunas da lista ("Tópico · Respostas · Visualizações ·
 * Atividade") e as classes que dizem à lista quais colunas existem.
 *
 * Entra no DiscussionList, e não em cada linha: as linhas guardam a árvore
 * (SubtreeRetainer) e não seriam redesenhadas quando a primeira discussão com
 * visualizações chegasse numa página nova.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import DiscussionList from 'flarum/forum/components/DiscussionList';
import IndexPage from 'flarum/forum/components/IndexPage';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type Mithril from 'mithril';

import { forumBool, t } from '../utils/settings';
import { listHasViews } from './metrics';
import { activeSort } from './sorts';
import listSkeleton from './listSkeleton';

/**
 * Se a última lista carregada tinha a coluna de visualizações: enquanto a
 * próxima carrega não há discussões para decidir, e o cabeçalho (e o
 * skeleton) não pode perder a coluna e ganhá-la de volta.
 */
let lastShowViews = true;

function sortableColumn(label: string, sort: string, enabled: boolean, className: string): Mithril.Children {
  if (!enabled || !(sort in app.discussions.sortMap())) {
    return <span className={classList('CanelaListHeader-cell', className)}>{label}</span>;
  }

  // A seta só aparece quando o leitor escolheu a ordem
  // pela coluna (ou pela URL); a lista padrão não marca nenhuma.
  const active = !!app.search.state.params().sort && activeSort() === sort;

  return (
    <button
      type="button"
      className={classList('Button--ua-reset CanelaListHeader-cell CanelaListHeader-sort', className, { active })}
      aria-pressed={active ? 'true' : 'false'}
      onclick={() => app.search.state.changeSort(sort)}
    >
      {label}
      {active && <Icon name="fas fa-chevron-down" className="CanelaListHeader-arrow" />}
    </button>
  );
}

function headerView(state: DiscussionListState, showViews: boolean): Mithril.Children {
  // Só a lista da página inicial (e das tags/seguindo) reordena pela URL; a
  // lista de discussões do perfil usa outro estado, e lá a coluna é só rótulo.
  const sortable = state === app.discussions && app.current.matches(IndexPage) && !state.isSearchResults();

  return (
    <div className="CanelaListHeader" role="presentation">
      <span className="CanelaListHeader-cell CanelaListHeader-cell--topic">{t('list.topic')}</span>
      {forumBool('canelaListPosters', true) && <span className="CanelaListHeader-cell CanelaCell--posters" />}
      {sortableColumn(t('list.replies'), 'top', sortable, 'CanelaCell--replies')}
      {showViews && <span className="CanelaListHeader-cell CanelaCell--views">{t('list.views')}</span>}
      {sortableColumn(t('list.activity'), 'latest', sortable, 'CanelaCell--activity')}
    </div>
  );
}

export default function installListHeader(): void {
  extend(DiscussionList.prototype, 'view', function (this: DiscussionList, vdom: Mithril.Vnode<any, any>) {
    const state = (this as any).attrs.state as DiscussionListState;

    if (!vdom || !state) return;

    // Primeira página carregando (troca de filtro, categoria ou ordem): as
    // linhas do skeleton no lugar do spinner, debaixo do cabeçalho.
    const loadingFirst = state.isInitialLoading() && !state.hasItems();

    if (!loadingFirst) lastShowViews = listHasViews(state);

    const showViews = forumBool('canelaListViews', true) && lastShowViews;

    vdom.attrs.className = classList(vdom.attrs.className, 'CanelaList', {
      'CanelaList--views': showViews,
      'CanelaList--posters': forumBool('canelaListPosters', true),
    });

    // A lista vazia devolve só o Placeholder: sem linhas, sem cabeçalho.
    if (!forumBool('canelaListHeader', true) || state.isEmpty() || !Array.isArray(vdom.children)) return;

    if (loadingFirst) {
      const children = vdom.children as any[];
      const list = children.find((child) => child?.attrs?.className === 'DiscussionList-discussions');
      const more = children.find((child) => child?.attrs?.className === 'DiscussionList-loadMore');

      if (list) {
        list.children = listSkeleton(showViews);
        if (more) more.children = [];
      }
    }

    // Os filhos do div (ul + "carregar mais") não têm key, então inserir um
    // irmão sem key no começo é seguro para o Mithril.
    vdom.children.unshift(headerView(state, showViews) as any);
  });
}
