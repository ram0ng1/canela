/*
 * As revisões de um artigo da linkrobins/wiki no mesmo modal do histórico de
 * edições dos posts (features/extras/history): a lista das revisões ao lado
 * (no celular, uma faixa no topo), ‹ › para andar entre elas, quem editou e
 * quando, e o diff por palavras do markdown, no texto ou lado a lado.
 *
 * Os dados são os que a wiki já usa no painel dela: o índice
 * `linkrobins-wiki-revisions` filtrado pelo artigo (da mais nova para a mais
 * antiga, 100 por página). Aqui a ordem vira a do modal (da mais antiga para
 * a mais nova), e o título e o resumo da revisão entram por cima do diff.
 */
import app from 'flarum/forum/app';
import { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import type Mithril from 'mithril';

import HistoryModal, { type Version, type VersionList } from '../../features/extras/history/HistoryModal';
import { fullDate, shortAge } from '../../utils/dates';
import { t } from '../../utils/settings';
import { wt } from './shared';

export interface WikiRevisionsModalAttrs extends IInternalModalAttrs {
  article: any;
}

interface WikiVersion extends Version {
  title: string;
  summary: string;
  model: any;
}

/** O teto da wiki por página; menos que isso, acabou. */
const PAGE = 100;
/** Até 1000 revisões: mais que isso só num artigo editado por robô. */
const MAX_PAGES = 10;

const wtr = (key: string, params: Record<string, unknown> = {}) => t(`thirdparty.wiki.${key}`, params);

function fetchPage(articleId: string, offset: number): Promise<any[]> {
  return app.store
    .find(
      'linkrobins-wiki-revisions' as any,
      {
        sort: '-createdAt',
        filter: { articleId },
        page: { limit: PAGE, offset },
        include: 'user',
        fields: { 'linkrobins-wiki-revisions': 'title,content,summary,createdAt,user' },
      } as any
    )
    .then((list: any) => (Array.isArray(list) ? list : []));
}

async function fetchAll(articleId: string): Promise<any[]> {
  const all: any[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const items = await fetchPage(articleId, all.length);

    all.push(...items);

    if (items.length < PAGE) break;
  }

  return all;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(String(value));

  return Number.isNaN(date.getTime()) ? null : date;
}

export default class WikiRevisionsModal extends HistoryModal<WikiRevisionsModalAttrs> {
  /** As versões com os campos da wiki (título, resumo e o modelo da revisão). */
  wikiVersions(): WikiVersion[] {
    return this.versions as WikiVersion[];
  }

  load(): Promise<VersionList> {
    const article = this.attrs.article;

    return fetchAll(String(article.id())).then((newestFirst) => {
      const versions: WikiVersion[] = newestFirst
        .slice()
        .reverse()
        .map((rev, index) => {
          const user = rev.user?.() || null;
          const created = toDate(rev.createdAt?.());

          return {
            number: index + 1,
            createdAt: created ? created.toISOString() : null,
            user: user
              ? { id: String(user.id()), username: user.username(), displayName: user.displayName(), avatarUrl: user.avatarUrl() || null }
              : null,
            content: rev.content?.() ?? '',
            title: rev.title?.() ?? '',
            summary: rev.summary?.() ?? '',
            model: rev,
          };
        });

      return { versions, contentHidden: false };
    });
  }

  className(): string {
    return 'CanelaHistoryModal CanelaWikiRevisionsModal Modal--large';
  }

  title(): Mithril.Children {
    return wtr('history_title');
  }

  content(): Mithril.Children {
    if (this.loading)
      return (
        <div className="Modal-body">
          <LoadingIndicator />
        </div>
      );

    if (this.failed || !this.versions.length) {
      return (
        <div className="Modal-body">
          <p className="CanelaHistory-empty">{this.failed ? wtr('history_failed') : wt('show.no_history', 'No revisions yet.')}</p>
        </div>
      );
    }

    return (
      <div className="Modal-body CanelaHistory CanelaWikiRevisions">
        {this.revisionList()}
        <div className="CanelaWikiRevisions-main">
          {this.navigation()}
          {this.comparison()}
        </div>
      </div>
    );
  }

  /** A lista ao lado, da mais nova para a mais antiga, como no painel da wiki. */
  revisionList(): Mithril.Children {
    const items = this.wikiVersions()
      .map((version, index) => ({ version, index }))
      .reverse();

    return (
      <ol className="CanelaWikiRevisions-list" aria-label={wtr('history_title')}>
        {items.map(({ version, index }) => {
          const user = version.model?.user?.() || null;
          const date = toDate(version.createdAt);
          const active = index === this.index;

          return (
            <li key={`rev-${version.number}`}>
              <button
                type="button"
                className={classList('Button--ua-reset CanelaWikiRevisions-item', { active })}
                aria-current={active ? 'true' : undefined}
                title={date ? fullDate(date) : undefined}
                onclick={() => (this.index = index)}
              >
                {user ? <Avatar user={user} className="CanelaWikiRevisions-avatar" /> : <Icon name="fas fa-user-pen" />}
                <span className="CanelaWikiRevisions-info">
                  <span className="CanelaWikiRevisions-line">
                    <span className="CanelaWikiRevisions-number">{`#${version.number}`}</span>
                    <span className="CanelaWikiRevisions-user">{version.user ? version.user.displayName : t('extras.history.deleted_user')}</span>
                  </span>
                  <span className="CanelaWikiRevisions-meta">
                    {index === 0 ? <span className="CanelaWikiTag">{wt('show.initial_version', 'created')}</span> : null}
                    {version.summary ? <span className="CanelaWikiRevisions-summary">{version.summary}</span> : null}
                  </span>
                </span>
                <span className="CanelaWikiRevisions-date">{shortAge(date)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    );
  }

  /** O resumo e a troca de título da revisão vêm antes do diff do texto. */
  comparison(): Mithril.Children {
    const versions = this.wikiVersions();
    const current = versions[this.index];
    const previous = this.index > 0 ? versions[this.index - 1] : null;
    const titleChanged = !!previous && previous.title !== current.title;

    return [
      current.summary ? (
        <p className="CanelaWikiRevisions-note">
          <Icon name="fas fa-quote-left" />
          <span>{current.summary}</span>
        </p>
      ) : null,
      titleChanged ? (
        <p className="CanelaWikiRevisions-title">
          <span className="CanelaWikiRevisions-titleLabel">{wt('show.diff_title', 'Title')}</span>
          <del className="CanelaHistory-del">{previous!.title}</del>
          <Icon name="fas fa-arrow-right" />
          <ins className="CanelaHistory-ins">{current.title}</ins>
        </p>
      ) : null,
      previous && previous.content === current.content ? (
        <p className="CanelaHistory-empty">{wt('show.diff_none', 'No content changes.')}</p>
      ) : (
        super.comparison()
      ),
    ];
  }
}
