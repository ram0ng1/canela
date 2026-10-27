/*
 * "Discussões relacionadas" (por embeddings): no fim do
 * tópico, antes dos sugeridos, os tópicos mais parecidos no significado — não
 * só nas palavras.
 *
 * O servidor devolve a lista pronta (já filtrada pelo que a pessoa vê, na
 * ordem da semelhança). A tabela reusa as classes dos sugeridos: as duas
 * listas são a mesma peça, com títulos
 * diferentes.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { categoryBadge, labelBadge, type CanelaTag } from '../../utils/tags';
import { fullDate, shortAge } from '../../utils/dates';
import { t } from '../../utils/settings';
import { relatedTopicsRequest } from './state';

interface RelatedTopic {
  id: string;
  title: string;
  url: string;
  replyCount: number;
  lastPostedAt: string | null;
  tagIds: string[];
}

/** Uma busca por tópico: a linha do fim aparece e some conforme o stream carrega. */
const cache = new Map<string, RelatedTopic[]>();

export interface RelatedTopicsAttrs extends ComponentAttrs {
  discussion: Discussion;
}

export default class RelatedTopics extends Component<RelatedTopicsAttrs> {
  oninit(vnode: Mithril.Vnode<RelatedTopicsAttrs, this>) {
    super.oninit(vnode);

    const id = this.attrs.discussion.id()!;

    if (cache.has(id)) return;

    cache.set(id, []);

    relatedTopicsRequest<RelatedTopic>(id)
      .then((response) => cache.set(id, response.data || []))
      .catch(() => {})
      .finally(() => m.redraw());
  }

  view() {
    const topics = cache.get(this.attrs.discussion.id()!) || [];

    if (!topics.length) return null;

    return (
      <section className="CanelaSuggested CanelaAiRelated related-topics" aria-labelledby="canela-ai-related-title">
        <h2 className="CanelaSuggested-title" id="canela-ai-related-title">
          <Icon name="fas fa-wand-magic-sparkles" /> {t('ai.related.title')}
        </h2>
        <table className="CanelaSuggested-table">
          <thead>
            <tr>
              <th scope="col" className="CanelaSuggested-topicHead">
                {t('ai.related.topic')}
              </th>
              <th scope="col" className="CanelaSuggested-num">
                {t('ai.related.replies')}
              </th>
              <th scope="col" className="CanelaSuggested-num">
                {t('ai.related.activity')}
              </th>
            </tr>
          </thead>
          <tbody>{topics.map((topic) => this.row(topic))}</tbody>
        </table>
      </section>
    );
  }

  row(topic: RelatedTopic): Mithril.Children {
    const last = topic.lastPostedAt ? new Date(topic.lastPostedAt) : null;
    const tags = topic.tagIds.map((id) => app.store.getById('tags', id) as unknown as CanelaTag | undefined).filter(Boolean) as CanelaTag[];

    return (
      <tr className="CanelaSuggested-row">
        <td className="CanelaSuggested-topic">
          <Link className="CanelaSuggested-link" href={topic.url}>
            {topic.title}
          </Link>
          {tags.length > 0 && (
            <div className="CanelaSuggested-badges">
              <span className="CanelaBadges">{tags.map((tag) => (tag.position() !== null ? categoryBadge(tag) : labelBadge(tag)))}</span>
            </div>
          )}
        </td>
        <td className="CanelaSuggested-num CanelaSuggested-replies">{abbreviateNumber(topic.replyCount)}</td>
        <td className="CanelaSuggested-num CanelaSuggested-activity" title={last ? fullDate(last) : ''}>
          {last ? shortAge(last) : ''}
        </td>
      </tr>
    );
  }
}
