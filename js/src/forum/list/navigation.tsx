/*
 * Troca a toolbar do core (dropdown de ordenação + botões) pela barra de
 * navegação do Discourse. Só o item `toolbar` muda: o aviso de novidades do
 * realtime e o que mais as extensões puserem em contentItems fica onde está.
 */
import { extend } from 'flarum/common/extend';
import IndexPage from 'flarum/forum/components/IndexPage';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import ListNavigation from './ListNavigation';

export default function installNavigation(): void {
  extend(IndexPage.prototype, 'contentItems', function (this: IndexPage, items: ItemList<Mithril.Children>) {
    if (!items.has('toolbar')) return;

    items.setContent('toolbar', <ListNavigation page={this} />);
  });
}
