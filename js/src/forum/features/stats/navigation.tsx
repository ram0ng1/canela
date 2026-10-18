/*
 * Onde as estatísticas aparecem na navegação: o "(N)" das abas Novos e Não
 * lidos, o pontinho do "Tópicos" na barra lateral e a ordenação por
 * visualizações no menu "mais" das abas.
 *
 * Tudo por `extend` nos componentes da lista e da barra lateral — os arquivos
 * dessas áreas não sabem que as estatísticas existem.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type { SortMap } from 'flarum/common/states/PaginatedListState';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import ListNavigation from '../../list/ListNavigation';
import CanelaSidebar from '../../components/CanelaSidebar';
import { forumBool, t } from '../../utils/settings';
import { countsEnabled, formatCount, newCount, refreshCounts, unreadCount } from './counts';

export const VIEWS_SORT = 'views';

/** O formato das abas do ListNavigation (a interface de lá não é exportada). */
interface Tab {
  key: string;
  label: Mithril.Children;
  href: string;
  active: boolean;
}

function viewsEnabled(): boolean {
  return forumBool('canelaStatsViewsEnabled', true);
}

/** URL da lista atual na ordenação pedida, como as outras abas montam. */
function sortHref(sort: string): string {
  const onIndex = app.current.matches(IndexPage);
  const params: Record<string, any> = onIndex ? { ...app.search.state.params() } : {};
  const routeName = onIndex ? app.current.get('routeName') || 'index' : 'index';

  params.sort = sort;
  Object.keys(params).forEach((key) => {
    if (params[key] === undefined || params[key] === '') delete params[key];
  });

  return app.route(routeName, params);
}

function withCount(label: Mithril.Children, count: number, kind: string): Mithril.Children {
  if (count <= 0) return label;

  return [
    label,
    ' ',
    <span className={`CanelaStatsCount CanelaStatsCount--${kind}`} title={t(`stats.${kind}_count`, { count })}>
      ({formatCount(count)})
    </span>,
  ];
}

function installViewsSort(): void {
  // Ordenação de verdade (`?sort=views`), para a URL e o pré-carregamento do
  // servidor funcionarem; a aba dela não fica na fileira principal, que é a
  // do Discourse, e sim no menu "mais", ao lado de "Mais antigos".
  extend(DiscussionListState.prototype, 'sortMap', function (map: SortMap) {
    if (viewsEnabled()) map[VIEWS_SORT] = { sort: '-viewCount', label: t('stats.views_sort') };
  });

  extend(ListNavigation.prototype, 'tabs', function (tabs: Tab[]) {
    const index = tabs.findIndex((tab) => tab.key === VIEWS_SORT);

    if (index !== -1) tabs.splice(index, 1);
  });

  extend(ListNavigation.prototype, 'overflowTabs', function (tabs: Tab[]) {
    if (!viewsEnabled() || !(VIEWS_SORT in app.discussions.sortMap())) return;

    const onIndex = app.current.matches(IndexPage);
    const sort = onIndex ? app.search.state.params().sort : undefined;

    tabs.push({ key: VIEWS_SORT, label: t('stats.views_sort'), href: sortHref(VIEWS_SORT), active: sort === VIEWS_SORT });
  });
}

function installTabCounts(): void {
  extend(ListNavigation.prototype, 'tabs', function (tabs: Tab[]) {
    if (!countsEnabled()) return;

    for (const tab of tabs) {
      if (tab.key === 'newest') tab.label = withCount(tab.label, newCount('page'), 'new');
      if (tab.key === 'unread') tab.label = withCount(tab.label, unreadCount('page'), 'unread');
    }
  });

  // Voltar para a lista é quando a contagem pode ter mudado (a pessoa acabou
  // de ler um tópico); o próprio refreshCounts ignora voltas muito seguidas.
  extend(IndexPage.prototype, 'oncreate', function () {
    refreshCounts();
  });
}

function installSidebarDot(): void {
  extend(CanelaSidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    if (!countsEnabled() || !items.has('topics')) return;

    const fresh = newCount();
    const unread = unreadCount();

    if (fresh + unread <= 0) return;

    const vnode = items.get('topics') as Mithril.Vnode<any, any>;

    if (!vnode || typeof vnode !== 'object' || !vnode.tag) return;

    const children = Array.isArray(vnode.children) ? vnode.children : vnode.children == null ? [] : [vnode.children];
    const label = t('stats.sidebar_dot', { new: fresh, unread });

    // O Discourse marca "Tópicos" com um ponto (e não um número) por padrão:
    // avisa que há novidade sem competir com o texto da barra.
    items.setContent(
      'topics',
      m(vnode.tag as any, { ...vnode.attrs, title: label }, [
        ...children,
        <span className="CanelaStatsDot" aria-hidden="true" />,
        <span className="sr-only">{label}</span>,
      ])
    );
  });
}

export default function installNavigation(): void {
  installViewsSort();
  installTabCounts();
  installSidebarDot();
}
