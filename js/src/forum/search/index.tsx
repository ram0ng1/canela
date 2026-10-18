/*
 * A busca do Discourse: o menu de busca (SearchMenu) no lugar do botão que
 * abria o SearchModal do core. O do cabeçalho é desenhado pelo HeaderSearch
 * (shell/); aqui entra o do banner de boas-vindas, que no Discourse é o mesmo
 * `search-menu`.
 */
import { extend } from 'flarum/common/extend';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import WelcomeBanner from '../list/WelcomeBanner';
import SearchMenu from './SearchMenu';

export { default as SearchMenu } from './SearchMenu';

export default function installSearchMenu(): void {
  extend(WelcomeBanner.prototype, 'bodyItems', function (items: ItemList<Mithril.Children>) {
    if (!items.has('search')) return;

    items.setContent(
      'search',
      <div className="CanelaWelcome-search">
        <SearchMenu location="welcome" />
      </div>
    );
  });
}
