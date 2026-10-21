/*
 * A busca do cabeçalho: o menu de busca (search/SearchMenu), em
 * que o próprio campo do cabeçalho é o campo da busca e os resultados abrem
 * num painel colado embaixo dele — no lugar do botão do core que abria o
 * SearchModal.
 */
import Component from 'flarum/common/Component';
import type Mithril from 'mithril';

import SearchMenu from '../search/SearchMenu';

export default class HeaderSearch extends Component {
  view(): Mithril.Children {
    return <SearchMenu location="header" />;
  }
}
