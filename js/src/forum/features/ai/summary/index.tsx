/*
 * O "Resumir" do mapa do tópico (o ai-summary-trigger do Discourse) e os
 * resumos curtos na lista de tópicos.
 *
 * O botão entra no fim do mapa do tópico, numa seção própria
 * (`topic-map__additional-contents`), e só aparece quando há um resumo pronto
 * ou quando a pessoa pode gerar um num tópico com postagens bastantes.
 */
import { extend } from 'flarum/common/extend';
import Button from 'flarum/common/components/Button';
import DiscussionListItem from 'flarum/forum/components/DiscussionListItem';
import type Discussion from 'flarum/common/models/Discussion';
import type ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import TopicMap from '../../../topic/components/TopicMap';
import { t } from '../../../utils/settings';
import { aiFeature, aiInfo } from '../state';
import { summaryState } from './SummaryPanel';

function canShowSummary(discussion: Discussion): boolean {
  if (!aiFeature('summary')) return false;

  if (discussion.attribute<boolean>('canelaAiHasSummary')) return true;

  return !!aiInfo()?.canSummarize && !!discussion.attribute<boolean>('canelaAiSummarizable');
}

export default function installSummary(): void {
  extend(TopicMap.prototype, 'view', function (this: TopicMap, vnode: Mithril.Vnode) {
    const discussion = this.attrs.discussion;

    if (!vnode || !Array.isArray((vnode as any).children) || !canShowSummary(discussion)) return;

    (vnode as any).children.push(
      <section className="topic-map__additional-contents toggle-summary CanelaTopicMap-ai">
        <Button className="Button ai-summarization-button" icon="fas fa-wand-magic-sparkles" onclick={() => summaryState.show(discussion)}>
          {t('ai.summary.generate')}
        </Button>
      </section>
    );
  });

  // O resumo curto (gist) toma o lugar do excerto da lista — "Expandido, com
  // resumos de IA" no Discourse. A lista decide se mostra excertos.
  extend(DiscussionListItem.prototype, 'infoItems', function (this: DiscussionListItem, items: ItemList<Mithril.Children>) {
    if (!aiFeature('gists')) return;

    const gist = this.attrs.discussion.attribute<string | null>('canelaAiGist');

    if (!gist || this.attrs.params?.q) return;

    if (items.has('excerpt')) items.remove('excerpt');

    items.add(
      'excerpt',
      <span className="CanelaAiGist excerpt">
        <span className="excerpt__contents">{gist}</span>
      </span>,
      -100
    );
  });
}
