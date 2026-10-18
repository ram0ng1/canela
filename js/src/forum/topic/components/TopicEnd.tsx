/*
 * O que vem depois do último post: os botões do tópico e os tópicos
 * sugeridos. Só aparece quando o stream chegou ao fim — no meio de um tópico
 * longo os posts seguintes ainda não carregaram, e o rodapé ficaria no meio.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';

import SuggestedTopics from './SuggestedTopics';
import TopicFooter from './TopicFooter';
import TopicMap, { hasBottomTopicMap } from './TopicMap';
import { topicSettings } from '../ui';

export interface TopicEndAttrs extends ComponentAttrs {
  discussion: Discussion;
  stream: any;
  page: any;
}

export default class TopicEnd extends Component<TopicEndAttrs> {
  view() {
    const { discussion, stream, page } = this.attrs;

    if (!stream || !stream.viewingEnd()) return null;

    const footer = topicSettings.footer();
    const suggested = topicSettings.suggested();

    if (!footer && !suggested) return null;

    return (
      <div className="CanelaTopicEnd">
        {/* O mapa se repete no fim dos tópicos longos (topic-map.--bottom). */}
        {topicSettings.map() && hasBottomTopicMap(discussion) && <TopicMap discussion={discussion} position="bottom" />}
        {footer && <TopicFooter discussion={discussion} page={page} />}
        {/* A chave refaz a busca ao ir de um tópico direto para outro; fica
            num array próprio porque o Mithril não aceita irmãos com e sem chave. */}
        {suggested && [<SuggestedTopics key={discussion.id()} discussion={discussion} />]}
      </div>
    );
  }
}
