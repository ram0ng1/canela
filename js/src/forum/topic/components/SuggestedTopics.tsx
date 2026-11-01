/*
 * Os tópicos sugeridos no fim do tópico: as abas "Sugestões" e
 * "✨ Relacionado(a)" no lugar do título, numa tabela compacta com respostas,
 * visualizações e atividade. Com uma lista só, ela ganha o título.
 *
 * - Sugestões: os mais recentes da mesma categoria (ou do fórum, sem tags).
 * - Relacionado(a): os tópicos semânticos do recurso de IA (embeddings),
 *   quando ligado; senão, os que dividem alguma etiqueta com este, os mais
 *   comentados primeiro. Sem nenhum, a aba some.
 *
 * As classes são próprias (.CanelaSuggested*): a lista principal tem outro
 * dono e outro ritmo de mudança, e as duas não devem quebrar juntas.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';

import { categoryBadge, discussionBadges, isTagsEnabled, labelBadge, splitDiscussionTags, type CanelaTag } from '../../utils/tags';
import { fullDate, shortAge } from '../../utils/dates';
import { forumBool, forumInt, t } from '../../utils/settings';
import { viewsHeat, viewsNumber } from '../../utils/views';
import { aiFeature, aiRequest } from '../../features/ai/state';
import { takePreloaded } from '../../utils/preload';

/** Uma linha da tabela, venha de um modelo do store ou da API de IA. */
interface Row {
  id: string;
  title: string;
  href: string;
  replies: number;
  views: number | null;
  last: Date | null;
  unread: number;
  badges: Mithril.Children;
}

interface Lists {
  suggested: Row[];
  related: Row[];
}

type Tab = keyof Lists;

/** O que a API de IA devolve em /related/{id}. */
interface AiRelated {
  id: string;
  title: string;
  url: string;
  replyCount: number;
  lastPostedAt: string | null;
  tagIds: string[];
}

/**
 * Listas já buscadas, por tópico: a linha do fim aparece e some conforme o
 * stream carrega posts, e cada vez seria uma requisição nova.
 */
const cache = new Map<string, Lists>();

export interface SuggestedTopicsAttrs extends ComponentAttrs {
  discussion: Discussion;
}

function include(): string {
  return isTagsEnabled() ? 'tags,user,lastPostedUser' : 'user,lastPostedUser';
}

function fromDiscussion(topic: Discussion): Row {
  const unread = !!app.session.user && topic.isUnread() ? topic.unreadCount() : 0;
  const views = topic.attribute<unknown>('viewCount');

  return {
    id: topic.id()!,
    title: topic.title(),
    href: app.route.discussion(topic, unread ? (topic.lastReadPostNumber() || 0) + 1 : undefined),
    replies: topic.replyCount(),
    views: typeof views === 'number' ? views : null,
    last: topic.lastPostedAt() || topic.createdAt() || null,
    unread,
    badges: discussionBadges(topic),
  };
}

function fromAi(topic: AiRelated): Row {
  const tags = topic.tagIds.map((id) => app.store.getById('tags', id) as CanelaTag | undefined).filter(Boolean) as CanelaTag[];
  const known = app.store.getById<Discussion>('discussions', topic.id);
  const views = known ? known.attribute<unknown>('viewCount') : null;

  return {
    id: topic.id,
    title: topic.title,
    href: topic.url,
    replies: topic.replyCount,
    views: typeof views === 'number' ? views : null,
    last: topic.lastPostedAt ? new Date(topic.lastPostedAt) : null,
    unread: 0,
    badges: tags.length ? (
      <span className="CanelaBadges">{tags.map((tag) => (tag.position() !== null ? categoryBadge(tag) : labelBadge(tag)))}</span>
    ) : null,
  };
}

export default class SuggestedTopics extends Component<SuggestedTopicsAttrs> {
  loading = false;
  tab: Tab = 'suggested';

  oninit(vnode: Mithril.Vnode<SuggestedTopicsAttrs, this>) {
    super.oninit(vnode);

    if (!cache.has(this.attrs.discussion.id()!)) this.load();
  }

  load() {
    const discussion = this.attrs.discussion;
    const id = discussion.id()!;
    const limit = forumInt('canelaSuggestedCount', 5);

    // Nas discussões curtas o servidor já mandou as listas com a página
    // (src/Preload): a tabela sai no primeiro desenho, sem esperar a rede.
    const preSuggested = this.preloadedSuggested(discussion, limit);
    const preRelated = this.preloadedRelated(discussion, limit);

    if (preSuggested && preRelated) {
      cache.set(id, this.lists(preSuggested, preRelated));
      return;
    }

    this.loading = true;

    Promise.all([preSuggested ?? this.loadSuggested(discussion, limit), preRelated ?? this.loadRelated(discussion, limit)])
      .then(([suggested, related]) => cache.set(id, this.lists(suggested, related)))
      .catch(() => cache.set(id, { suggested: [], related: [] }))
      .finally(() => {
        this.loading = false;
        m.redraw();
      });
  }

  /** As duas listas, sem repetir em "Relacionado(a)" o que já está em "Sugestões". */
  lists(suggested: Row[], related: Row[]): Lists {
    const seen = new Set(suggested.map((row) => row.id));

    return { suggested, related: related.filter((row) => !seen.has(row.id)) };
  }

  /** O pedido de "Sugestões" (o servidor pré-carrega o mesmo: os parâmetros são a chave). */
  suggestedParams(discussion: Discussion, limit: number): Record<string, unknown> {
    const { categories } = splitDiscussionTags(discussion);
    // A mais específica: a filha, quando o tópico está numa subcategoria.
    const category = categories[categories.length - 1];

    const params: Record<string, unknown> = { sort: '-lastPostedAt', page: { limit: limit + 1 }, include: include() };

    if (category) params.filter = { tag: category.slug() };

    return params;
  }

  /** O pedido de "Relacionado(a)" sem IA; null sem etiquetas. Os slugs em ordem alfabética, como no servidor. */
  relatedParams(discussion: Discussion, limit: number): Record<string, unknown> | null {
    const { labels } = splitDiscussionTags(discussion);

    if (!labels.length) return null;

    const slugs = labels.map((tag) => tag.slug()).sort();

    return { sort: '-commentCount', filter: { tag: slugs.join(',') }, page: { limit: limit * 2 }, include: include() };
  }

  rowsOf(discussion: Discussion, results: Discussion[], limit: number): Row[] {
    return Array.from(results)
      .filter((item) => item && item.id() !== discussion.id())
      .slice(0, limit)
      .map(fromDiscussion);
  }

  preloadedSuggested(discussion: Discussion, limit: number): Row[] | null {
    const payload = takePreloaded('discussions', this.suggestedParams(discussion, limit));

    return payload ? this.rowsOf(discussion, app.store.pushPayload<Discussion[]>(payload) as Discussion[], limit) : null;
  }

  preloadedRelated(discussion: Discussion, limit: number): Row[] | null {
    if (aiFeature('related')) {
      const payload = takePreloaded<{ data: AiRelated[] }>(`canela/ai/related/${discussion.id()}`);

      return payload ? (payload.data || []).slice(0, limit).map(fromAi) : null;
    }

    const params = this.relatedParams(discussion, limit);

    // Sem etiquetas não há o que buscar: a lista vazia já é a resposta.
    if (!params) return [];

    const payload = takePreloaded('discussions', params);

    return payload ? this.rowsOf(discussion, app.store.pushPayload<Discussion[]>(payload) as Discussion[], limit) : null;
  }

  loadSuggested(discussion: Discussion, limit: number): Promise<Row[]> {
    return app.store
      .find<Discussion[]>('discussions', this.suggestedParams(discussion, limit), undefined, { errorHandler: () => {} })
      .then((results) => this.rowsOf(discussion, results as Discussion[], limit))
      .catch(() => []);
  }

  loadRelated(discussion: Discussion, limit: number): Promise<Row[]> {
    if (aiFeature('related')) {
      return aiRequest<{ data: AiRelated[] }>('GET', `related/${discussion.id()}`)
        .then((response) => (response.data || []).slice(0, limit).map(fromAi))
        .catch(() => []);
    }

    // Sem IA: os que dividem uma etiqueta (o filtro do tags junta por "ou").
    const params = this.relatedParams(discussion, limit);

    if (!params) return Promise.resolve([]);

    return app.store
      .find<Discussion[]>('discussions', params, undefined, { errorHandler: () => {} })
      .then((results) => this.rowsOf(discussion, results as Discussion[], limit))
      .catch(() => []);
  }

  view() {
    if (this.loading) {
      return (
        <section className="CanelaSuggested">
          <LoadingIndicator display="block" />
        </section>
      );
    }

    const lists = cache.get(this.attrs.discussion.id()!) || { suggested: [], related: [] };
    const tabs = (['suggested', 'related'] as Tab[]).filter((tab) => lists[tab].length);

    if (!tabs.length) return null;

    const tab = tabs.indexOf(this.tab) !== -1 ? this.tab : tabs[0];
    const rows = lists[tab];
    const views = rows.some((row) => row.views !== null);
    const single = tabs.length === 1;

    return (
      <section className={classList('CanelaSuggested', { 'CanelaSuggested--tabs': !single })} aria-labelledby="canela-suggested-title">
        {single && (
          <h2 className="CanelaSuggested-title" id="canela-suggested-title">
            {tab === 'related' && <Icon name="fas fa-wand-magic-sparkles" />} {t(`topic.suggested.${tab === 'related' ? 'related_title' : 'title'}`)}
          </h2>
        )}
        <table className="CanelaSuggested-table">
          <thead>
            <tr>
              <th scope="col" className="CanelaSuggested-topicHead">
                {single ? (
                  t('topic.suggested.topic')
                ) : (
                  <ul className="CanelaSuggested-tabs" role="tablist" id="canela-suggested-title">
                    {tabs.map((key) => (
                      <li>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={key === tab ? 'true' : 'false'}
                          className={classList('CanelaSuggested-tab', { active: key === tab })}
                          onclick={() => (this.tab = key)}
                        >
                          {key === 'related' && <Icon name="fas fa-wand-magic-sparkles" />}
                          {t(`topic.suggested.tab_${key}`)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </th>
              <th scope="col" className="CanelaSuggested-num">
                {t('topic.suggested.replies')}
              </th>
              {views && (
                <th scope="col" className="CanelaSuggested-num">
                  {t('topic.suggested.views')}
                </th>
              )}
              <th scope="col" className="CanelaSuggested-num">
                {t('topic.suggested.activity')}
              </th>
            </tr>
          </thead>
          <tbody>{rows.map((row) => this.row(row, views))}</tbody>
        </table>
      </section>
    );
  }

  row(row: Row, views: boolean) {
    return (
      <tr className={classList('CanelaSuggested-row', { 'CanelaSuggested-row--unread': row.unread > 0 })}>
        <td className="CanelaSuggested-topic">
          <Link className="CanelaSuggested-link" href={row.href}>
            {row.title}
          </Link>
          {row.unread > 0 && <span className="CanelaSuggested-unread">{abbreviateNumber(row.unread)}</span>}
          <div className="CanelaSuggested-badges">{row.badges}</div>
        </td>
        <td className="CanelaSuggested-num CanelaSuggested-replies">{abbreviateNumber(row.replies)}</td>
        {views && this.viewsCell(row.views || 0)}
        <td className="CanelaSuggested-num CanelaSuggested-activity" title={row.last ? fullDate(row.last) : ''}>
          {row.last ? shortAge(row.last) : ''}
        </td>
      </tr>
    );
  }

  /** Como a coluna da lista: o número curto, o title por extenso e o calor (`heatmap-*`). */
  viewsCell(count: number) {
    const heat = forumBool('canelaListHeat', true) ? viewsHeat(count) : null;

    return <td className={classList('CanelaSuggested-num CanelaSuggested-views', heat && `heatmap-${heat}`)}>{viewsNumber(count)}</td>;
  }
}
