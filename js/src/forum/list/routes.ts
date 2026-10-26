/*
 * Os endereços das listas: /latest, /hot, /top, /new, /unread (a lista na
 * ordenação correspondente) e /categories (a página de categorias). O
 * servidor responde as mesmas rotas (extend/listroutes.php); /c/<slug> é
 * redirecionado lá para /t/<slug>.
 */
import app from 'flarum/forum/app';
import { extend, override } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import GlobalSearchState from 'flarum/forum/states/GlobalSearchState';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import setRouteWithForcedRefresh from 'flarum/common/utils/setRouteWithForcedRefresh';
import Extend from 'flarum/common/extenders';
import type Application from 'flarum/common/Application';
import type { IExtensionModule } from 'flarum/common/extenders/IExtender';

import { isTagsEnabled } from '../utils/tags';
import { HOT_SORT, UNREAD_SORT } from './sorts';

/** Rota → ordenação. "Novos" é a lista dos mais novos. */
export const SORT_ROUTES: Record<string, string> = {
  'canela.latest': 'latest',
  'canela.hot': HOT_SORT,
  'canela.top': 'top',
  'canela.new': 'newest',
  'canela.unread': UNREAD_SORT,
};

const PATHS: Record<string, `/${string}`> = {
  'canela.latest': '/latest',
  'canela.hot': '/hot',
  'canela.top': '/top',
  'canela.new': '/new',
  'canela.unread': '/unread',
};

/** A rota de uma ordenação, se houver. */
export function routeForSort(sort: string): string | null {
  return Object.keys(SORT_ROUTES).find((name) => SORT_ROUTES[name] === sort) || null;
}

export function currentSortRoute(): string | null {
  const name = app.current.get('routeName');

  return name && name in SORT_ROUTES ? name : null;
}

/** As rotas das listas (extenders do fórum, em ./extend.ts). */
export const listRoutes = {
  extend(app: Application, extension: IExtensionModule) {
    const routes = new Extend.Routes();

    Object.keys(PATHS).forEach((name) => routes.add(name, PATHS[name], IndexPage));

    // Sem o flarum/tags não há página de categorias: /categories mostra a
    // lista. Na hora de aplicar os extenders todas as extensões já
    // carregaram, então o módulo do flarum/tags já está no registro.
    const TagsPage = isTagsEnabled() ? flarum.reg.checkModule('flarum-tags', 'forum/components/TagsPage') : null;

    routes.add('canela.categories', '/categories', TagsPage || IndexPage);
    routes.extend(app, extension);
  },
};

export default function installRoutes(): void {
  // Em /top (e nas outras), a ordenação vem da rota quando a URL não traz `sort`.
  extend(GlobalSearchState.prototype, 'stickyParams', function (params: any) {
    const route = currentSortRoute();

    if (route && !params.sort) params.sort = SORT_ROUTES[route];
  });

  // Trocar a ordenação numa dessas rotas leva à rota da nova ordenação (ou à
  // lista com `?sort=`), e não à mesma rota com outro parâmetro.
  override(GlobalSearchState.prototype, 'changeSort', function (this: GlobalSearchState, original: (sort: string) => void, sort: string) {
    if (!currentSortRoute()) return original(sort);

    const { sort: _old, ...params } = this.params() as Record<string, any>;
    const target = routeForSort(sort);

    setRouteWithForcedRefresh(target ? app.route(target, params) : app.route('index', { ...params, sort }));
  });

  // O servidor pré-carrega essas rotas como a lista padrão (Recentes): fora
  // de Recentes, o documento pré-carregado não serve e a lista vai à API.
  // loadPage é protegido no tipo; a extensão é a mesma de qualquer método.
  override(
    DiscussionListState.prototype as any,
    'loadPage' as any,
    function (this: DiscussionListState, original: (page?: number) => any, ...args: unknown[]): any {
      const page = args[0] as number | undefined;
      const sort = this.getParams().sort;

      if (sort && sort !== 'latest' && (currentSortRoute() || sort === HOT_SORT || sort === UNREAD_SORT)) {
        app.data.apiDocument = null;
      }

      return original(page);
    }
  );
}
