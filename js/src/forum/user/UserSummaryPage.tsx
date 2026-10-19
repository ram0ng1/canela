/*
 * A aba "Resumo" do perfil do Discourse: os números em linha ("1,9k dias
 * acessados"), e em duas colunas as melhores respostas e os melhores tópicos
 * da pessoa — cada item com a data e as curtidas em cima e o título embaixo.
 *
 * O Flarum não guarda tempo de leitura nem dias visitados, então os números
 * ficam com o que existe: dias de casa, curtidas dadas (com o flarum/likes;
 * a contagem vem do `meta.page.total` da busca de posts curtidos), tópicos e
 * postagens criados.
 *
 * "Melhores" segue o Discourse — mais curtidas primeiro — dentro de uma
 * amostra recente (as últimas postagens, os tópicos mais respondidos): a API
 * do Flarum não ordena por curtidas.
 */
import app from 'flarum/forum/app';
import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import ItemList from 'flarum/common/utils/ItemList';
import formatNumber from 'flarum/common/utils/formatNumber';
import stringToColor from 'flarum/common/utils/stringToColor';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import type User from 'flarum/common/models/User';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { fullDate, shortDate } from '../utils/dates';
import { isExtensionEnabled, t } from '../utils/settings';
import { formatReadTime, userActivity } from '../features/stats/activity';
import { formatViews } from '../utils/views';

/** Quantos itens em cada coluna, como no Discourse. */
const LIST_LIMIT = 6;
/** Amostras de onde saem os "melhores". */
const REPLY_SAMPLE = 50;
const TOPIC_SAMPLE = 20;

// Só os campos que as listas desenham (JSON:API "sparse fieldsets"): sem o
// HTML e o texto de cada post, a amostra (e o pré-carregamento do Resumo, que
// espelha estes pedidos em src/Preload/PreloadContent.php) cai para ~1/4. Os
// modelos parciais no store não atrapalham: o fluxo do tópico recarrega o post
// sem `canEdit`, e as outras telas pedem os seus.
const TOPIC_FIELDS = { discussions: 'title,slug,commentCount,createdAt,firstPost', posts: 'likesCount' };
const REPLY_FIELDS = { posts: 'number,createdAt,likesCount,discussion', discussions: 'title,slug' };
const DAY = 24 * 60 * 60 * 1000;

function likesOf(post: Post | null | undefined | false): number | null {
  const value = post ? post.attribute<number | undefined>('likesCount') : undefined;

  return typeof value === 'number' ? value : null;
}

interface SummaryUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  color: string | null;
  count: number;
}

interface SummaryCategory {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  icon: string | null;
  topics: number;
  replies: number;
}

interface SummaryLink {
  url: string;
  title: string | null;
  domain: string;
  clicks: number;
  postNumber: number;
  discussionId: string;
  discussionSlug: string;
  discussionTitle: string;
}

interface SummaryExtra {
  mostRepliedTo: SummaryUser[] | null;
  mostLikedBy: SummaryUser[] | null;
  mostLiked: SummaryUser[] | null;
  topCategories: SummaryCategory[] | null;
  /** Recurso `links`: null com ele desligado. */
  topLinks?: SummaryLink[] | null;
}

export default class UserSummaryPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  topics: Discussion[] | null = null;
  replies: Post[] | null = null;
  likesGiven: number | null = null;
  /** As listas do backend do resumo (recurso `usersummary`); null sem ele. */
  extra: SummaryExtra | null = null;

  /** O usuário cujos dados já foram pedidos: `show()` roda de novo quando o perfil completo chega. */
  private loadedFor: User | null = null;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    super.show(user);

    if (this.loadedFor === user) return;

    this.loadedFor = user;
    this.load(user);
  }

  likesEnabled(): boolean {
    return isExtensionEnabled('flarum-likes');
  }

  load(user: User): void {
    // Erros aqui não merecem alerta: a seção fica vazia e o resto do perfil segue.
    const quiet = { errorHandler: () => {} };
    const byLikes = (a: Post | null, b: Post | null) => (likesOf(b) ?? 0) - (likesOf(a) ?? 0);

    app.store
      .find<Discussion[]>(
        'discussions',
        {
          filter: { author: user.slug() },
          sort: '-commentCount',
          include: 'firstPost',
          fields: TOPIC_FIELDS,
          page: { limit: TOPIC_SAMPLE, total: 0 },
        } as any,
        undefined,
        quiet
      )
      .then((topics) => {
        // A ordem da API (mais respondidos) desempata; o sort é estável.
        const list = topics.slice();
        if (this.likesEnabled()) list.sort((a, b) => byLikes(a.firstPost() || null, b.firstPost() || null));
        this.topics = list.slice(0, LIST_LIMIT);
      })
      .catch(() => (this.topics = []))
      .finally(() => m.redraw());

    app.store
      .find<Post[]>(
        'posts',
        {
          filter: { author: user.slug(), type: 'comment' },
          sort: '-createdAt',
          include: 'discussion',
          fields: REPLY_FIELDS,
          page: { limit: REPLY_SAMPLE, total: 0 },
        } as any,
        undefined,
        quiet
      )
      .then((posts) => {
        // Respostas são as postagens que não abrem o tópico.
        const replies = posts.filter((post) => post.discussion() && (post.number() || 0) > 1);
        if (this.likesEnabled()) replies.sort(byLikes);
        this.replies = replies.slice(0, LIST_LIMIT);
      })
      .catch(() => (this.replies = []))
      .finally(() => m.redraw());

    // "Mais respondidos(as)", "Mais curtido por", "Com mais curtidas",
    // "Melhores tags": sem o recurso no servidor a rota não existe e as
    // seções simplesmente não aparecem.
    this.extra = null;
    app
      .request<SummaryExtra>({ method: 'GET', url: `${app.forum.attribute('apiUrl')}/canela-user-summary/${user.id()}`, ...quiet })
      .then((extra) => {
        if (this.loadedFor === user && extra && typeof extra === 'object') this.extra = extra;
      })
      .catch(() => {})
      .finally(() => m.redraw());

    if (this.likesEnabled()) {
      app.store
        .find<Post[]>('posts', { filter: { likedBy: user.username() }, page: { limit: 1 } } as any, undefined, quiet)
        .then((result: any) => {
          const total = result?.payload?.meta?.page?.total;
          this.likesGiven = typeof total === 'number' ? total : null;
        })
        .catch(() => (this.likesGiven = null))
        .finally(() => m.redraw());
    }
  }

  content(): Mithril.Children {
    return <div className="CanelaUserSummary">{this.sectionItems().toArray()}</div>;
  }

  sectionItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const user = this.user!;

    items.add(
      'stats',
      <section className="CanelaUserSummary-section CanelaUserSummary-stats">
        <h3 className="CanelaUserSummary-heading">{t('user.summary.stats_heading')}</h3>
        <ul className="CanelaUserSummary-statList">{this.statItems().toArray()}</ul>
      </section>,
      100
    );

    items.add(
      'columns',
      <div className="CanelaUserSummary-columns">
        <section className="CanelaUserSummary-section CanelaUserSummary-replies">
          <h3 className="CanelaUserSummary-heading">{t('user.summary.top_replies_heading')}</h3>
          {this.list(this.replies, (post) => this.replyItem(post), t('user.summary.no_replies'))}
          {!!this.replies?.length && (
            <Link className="CanelaUserSummary-more" href={app.route('user.posts', { username: user.slug() })}>
              {t('user.summary.more_replies')}
            </Link>
          )}
        </section>
        <section className="CanelaUserSummary-section CanelaUserSummary-topics">
          <h3 className="CanelaUserSummary-heading">{t('user.summary.top_topics_heading')}</h3>
          {this.list(this.topics, (discussion) => this.topicItem(discussion), t('user.summary.no_topics'))}
          {!!this.topics?.length && (
            <Link className="CanelaUserSummary-more" href={app.route('user.discussions', { username: user.slug() })}>
              {t('user.summary.more_topics')}
            </Link>
          )}
        </section>
      </div>,
      90
    );

    const extra = this.extra;

    if (extra) {
      // Os pares de seções sempre lado a lado, como no Discourse: uma seção sem
      // dados mostra o título e "nada ainda", em vez de sumir e deixar a outra
      // sozinha numa linha.
      items.add(
        'mostRepliedTo',
        <div className="CanelaUserSummary-columns">
          {this.linksSection(extra.topLinks || [])}
          {this.userSection(
            'most-replied-to',
            t('user.summary.most_replied_to'),
            extra.mostRepliedTo || [],
            'fas fa-reply',
            t('user.summary.empty_replied')
          )}
        </div>,
        88
      );

      items.add(
        'likes',
        <div className="CanelaUserSummary-columns">
          {this.userSection('most-liked-by', t('user.summary.most_liked_by'), extra.mostLikedBy || [], 'fas fa-heart', t('user.summary.empty_likes'))}
          {this.userSection('most-liked', t('user.summary.most_liked'), extra.mostLiked || [], 'fas fa-heart', t('user.summary.empty_likes'))}
        </div>,
        87
      );

      if (extra.topCategories?.length) items.add('topCategories', this.categoriesSection(extra.topCategories), 86);
    }

    return items;
  }

  /** `.summary-user-list`: avatar, nome de usuário e nome, e a contagem embaixo. */
  userSection(name: string, heading: string, users: SummaryUser[], icon: string, emptyText = ''): Mithril.Children {
    if (!users.length) {
      return (
        <section className={`CanelaUserSummary-section CanelaUserSummary-${name}`}>
          <h3 className="CanelaUserSummary-heading">{heading}</h3>
          <p className="CanelaUserSummary-empty">{emptyText}</p>
        </section>
      );
    }

    return (
      <section className={`CanelaUserSummary-section CanelaUserSummary-${name}`}>
        <h3 className="CanelaUserSummary-heading">{heading}</h3>
        <ul className="CanelaSummaryUsers">
          {users.map((user) => (
            <li className="CanelaSummaryUsers-item" key={user.id}>
              <Link className="CanelaSummaryUsers-avatar" href={app.route('user', { username: user.username })} tabindex="-1" aria-hidden="true">
                {user.avatarUrl ? (
                  <img className="Avatar" src={user.avatarUrl} alt="" loading="lazy" />
                ) : (
                  <span className="Avatar" style={{ '--avatar-bg': user.color || `#${stringToColor(user.displayName || user.username)}` }}>
                    {(user.displayName || user.username).charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
              <div className="CanelaSummaryUsers-details">
                <div className="CanelaSummaryUsers-names">
                  <Link className="CanelaSummaryUsers-username" href={app.route('user', { username: user.username })}>
                    {user.username}
                  </Link>
                  {user.displayName && user.displayName !== user.username ? (
                    <span className="CanelaSummaryUsers-name">{user.displayName}</span>
                  ) : null}
                </div>
                <span className="CanelaSummaryUsers-count" title={formatNumber(user.count)}>
                  <Icon name={icon} /> {abbreviateNumber(user.count)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  /** `.top-links`: os cliques, o link (título ou endereço) e o tópico onde ele está. */
  linksSection(links: SummaryLink[]): Mithril.Children {
    if (!links.length) {
      return (
        <section className="CanelaUserSummary-section CanelaUserSummary-topLinks">
          <h3 className="CanelaUserSummary-heading">{t('user.summary.top_links')}</h3>
          <p className="CanelaUserSummary-empty">{t('user.summary.empty_links')}</p>
        </section>
      );
    }

    return (
      <section className="CanelaUserSummary-section CanelaUserSummary-topLinks">
        <h3 className="CanelaUserSummary-heading">{t('user.summary.top_links')}</h3>
        <ul className="CanelaSummaryList CanelaSummaryLinks">
          {links.map((link) => (
            <li className="CanelaSummaryList-item CanelaSummaryLinks-item" key={link.url}>
              <span className="CanelaSummaryLinks-clicks badge clicks" title={t('links.clicks', { count: link.clicks })}>
                {formatViews(link.clicks)}
              </span>{' '}
              <a className="CanelaSummaryLinks-link" href={link.url} target="_blank" rel="noopener nofollow ugc" title={link.url}>
                {link.title || link.url.replace(/^https?:\/\//, '')}
              </a>
              <br />
              <Link
                className="CanelaSummaryList-title CanelaSummaryLinks-topic"
                href={app.route('discussion.near', {
                  id: link.discussionSlug ? `${link.discussionId}-${link.discussionSlug}` : link.discussionId,
                  near: link.postNumber,
                })}
              >
                {link.discussionTitle}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  /** `.top-categories-section`: a categoria, os tópicos e as respostas. */
  categoriesSection(categories: SummaryCategory[]): Mithril.Children {
    return (
      <section className="CanelaUserSummary-section CanelaUserSummary-topCategories">
        <h3 className="CanelaUserSummary-heading">{t('user.summary.top_categories')}</h3>
        <table className="CanelaSummaryCategories">
          <thead>
            <tr>
              <th />
              <th className="CanelaSummaryCategories-count">{t('user.summary.topics')}</th>
              <th className="CanelaSummaryCategories-count">{t('user.summary.replies_column')}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => (
              <tr key={category.id}>
                <td>
                  <Link className="CanelaSummaryCategories-badge" href={app.route('tag', { tags: category.slug })}>
                    <span className="CanelaSummaryCategories-swatch" style={{ background: category.color || 'var(--cn-primary-medium)' }} />
                    <span>{category.name}</span>
                  </Link>
                </td>
                <td className="CanelaSummaryCategories-count">{formatNumber(category.topics)}</td>
                <td className="CanelaSummaryCategories-count">{formatNumber(category.replies)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    );
  }

  statItems(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const user = this.user!;

    // Com o recurso de estatísticas, os números do Discourse na mesma ordem:
    // dias acessados, tempo de leitura, tópicos visualizados, postagens lidas,
    // curtidas dadas e recebidas, tópicos e postagens criados, soluções.
    const activity = userActivity(user);

    if (activity && activity.daysVisited !== null) {
      items.add('daysVisited', this.stat(activity.daysVisited, t('user.summary.days_visited', { count: activity.daysVisited })), 100);
    } else {
      const joinTime = user.joinTime();
      if (joinTime) {
        const days = Math.max(1, Math.floor((Date.now() - joinTime.getTime()) / DAY));
        items.add('days', this.stat(days, t('user.summary.days_member', { count: days }), fullDate(joinTime)), 100);
      }
    }

    if (activity && activity.timeRead !== null) {
      items.add('timeRead', this.statText(formatReadTime(activity.timeRead), t('user.summary.time_read')), 98);
    }

    // "Tempo de leitura recente" (60 dias), só quando há algum, como no Discourse.
    if (activity && activity.recentTimeRead) {
      items.add('recentTimeRead', this.statText(formatReadTime(activity.recentTimeRead), t('user.summary.recent_time_read')), 97);
    }

    if (activity && activity.topicsViewed !== null) {
      items.add('topicsViewed', this.stat(activity.topicsViewed, t('user.summary.topics_viewed')), 96);
    }

    if (activity && activity.postsRead !== null) {
      items.add('postsRead', this.stat(activity.postsRead, t('user.summary.posts_read')), 94);
    }

    const likesGiven = activity && activity.likesGiven !== null ? activity.likesGiven : this.likesGiven;

    if (likesGiven !== null) {
      items.add('likesGiven', this.stat(likesGiven, t('user.summary.likes_given_short'), undefined, 'far fa-heart'), 90);
    }

    if (activity && activity.likesReceived !== null) {
      items.add('likesReceived', this.stat(activity.likesReceived, t('user.summary.likes_received_short'), undefined, 'far fa-heart'), 85);
    }

    items.add('topics', this.stat(user.discussionCount() || 0, t('user.summary.topics_created')), 80);
    items.add('posts', this.stat(user.commentCount() || 0, t('user.summary.posts_created')), 70);

    const solutions = user.attribute<number | null | undefined>('bestAnswerCount');

    if (typeof solutions === 'number') {
      items.add('solutions', this.stat(solutions, t('user.summary.solutions'), undefined, 'far fa-square-check'), 60);
    }

    return items;
  }

  /** "7 meses tempo de leitura": o valor já formatado. */
  statText(value: string, label: string): Mithril.Children {
    return (
      <li className="CanelaUserSummary-stat">
        <span className="CanelaUserSummary-stat-value">{value}</span> <span className="CanelaUserSummary-stat-label">{label}</span>
      </li>
    );
  }

  /** "1,9k dias acessados": o número abreviado, com o exato no title. */
  stat(value: number, label: string, title?: string, icon?: string): Mithril.Children {
    return (
      <li className="CanelaUserSummary-stat" title={title || formatNumber(value)}>
        <span className="CanelaUserSummary-stat-value">{abbreviateNumber(value)}</span>{' '}
        <span className="CanelaUserSummary-stat-label">
          {icon && [<Icon name={icon} className="CanelaUserSummary-stat-icon" />, ' ']}
          {label}
        </span>
      </li>
    );
  }

  list<T>(models: T[] | null, render: (model: T) => Mithril.Children, emptyText: string): Mithril.Children {
    // Carregando: linhas no formato dos itens (data em cima, título embaixo), para a coluna não saltar quando chegarem.
    if (models === null) {
      return (
        <ul className="CanelaSummaryList CanelaSummaryList--loading" aria-busy="true">
          {['62%', '78%', '54%'].map((width) => (
            <li className="CanelaSummaryList-item">
              <span className="CanelaSkeleton CanelaSummaryList-fake" style={{ width: '6em' }} />
              <br />
              <span className="CanelaSkeleton CanelaSummaryList-fake" style={{ width }} />
            </li>
          ))}
        </ul>
      );
    }

    if (!models.length) return <p className="CanelaUserSummary-empty">{emptyText}</p>;

    return <ul className="CanelaSummaryList">{models.map((model) => render(model))}</ul>;
  }

  /** "abr 2022 · ♡ 15" em cima, o título do tópico embaixo. */
  meta(date: Date | undefined | null, likes: number | null, replies?: number): Mithril.Children {
    const parts: Mithril.Children[] = [];

    if (date) {
      parts.push(
        <time datetime={date.toISOString()} title={fullDate(date)}>
          {shortDate(date)}
        </time>
      );
    }

    if (likes !== null) {
      parts.push(
        <span className="CanelaSummaryList-likes">
          <Icon name="far fa-heart" /> {formatNumber(likes)}
        </span>
      );
    } else if (replies !== undefined) {
      parts.push(
        <span className="CanelaSummaryList-replies" title={t('user.summary.replies', { count: replies })}>
          <Icon name="fas fa-reply" /> {formatNumber(replies)}
        </span>
      );
    }

    return <span className="CanelaSummaryList-meta">{parts.map((part, index) => [index > 0 ? ' · ' : null, part])}</span>;
  }

  topicItem(discussion: Discussion): Mithril.Children {
    const replies = Math.max(0, (discussion.commentCount() || 1) - 1);
    const likes = this.likesEnabled() ? likesOf(discussion.firstPost() || null) : null;

    return (
      <li className="CanelaSummaryList-item" key={discussion.id()}>
        {this.meta(discussion.createdAt(), likes, replies)}
        <br />
        <Link className="CanelaSummaryList-title" href={app.route.discussion(discussion)}>
          {discussion.title()}
        </Link>
      </li>
    );
  }

  replyItem(post: Post): Mithril.Children {
    const discussion = post.discussion() as Discussion;

    return (
      <li className="CanelaSummaryList-item" key={post.id()}>
        {this.meta(post.createdAt(), this.likesEnabled() ? likesOf(post) : null)}
        <br />
        <Link className="CanelaSummaryList-title" href={app.route.post(post)}>
          {discussion.title()}
        </Link>
      </li>
    );
  }
}
