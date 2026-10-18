/*
 * O mapa do tópico entra logo depois do primeiro post, pelo
 * afterFirstPostItems do PostStream (um chunk carregado sob demanda, daí o
 * extend pelo nome do módulo).
 */
import { extend } from 'flarum/common/extend';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import TopicMap, { hasTopicMap } from './components/TopicMap';
import { topicSettings } from './ui';

export default function installTopicMap(): void {
  extend('flarum/forum/components/PostStream', 'afterFirstPostItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (!topicSettings.map() || !this.discussion || !hasTopicMap(this.discussion)) return;

    items.add('canelaTopicMap', <TopicMap discussion={this.discussion} />, 100);
  });
}
