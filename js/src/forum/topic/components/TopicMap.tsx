/*
 * O mapa do tópico do Discourse atual (topic-map.--op), logo abaixo do
 * primeiro post: uma faixa entre duas linhas com os números em destaque
 * (visualizações, curtidas, usuários) e, ao lado, os avatares de quem mais
 * participou. Curtidas e usuários abrem um menu ("Respostas mais curtidas",
 * "Autores frequentes"), como lá. Em tópicos longos ele se repete no fim
 * (topic-map.--bottom).
 *
 * Só o menu das visualizações faz requisição (os dias do gráfico, ao abrir).
 * Visualizações só aparecem quando alguma extensão já manda o atributo; usuários e curtidas são contados dos posts, mas só
 * quando todos já estão na memória — uma soma parcial seria um número errado
 * com cara de certo. Sem eles, entra o número de respostas, que o Flarum
 * sempre tem.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Avatar from 'flarum/common/components/Avatar';
import Icon from 'flarum/common/components/Icon';
import Link from 'flarum/common/components/Link';
import abbreviateNumber from 'flarum/common/utils/abbreviateNumber';
import classList from 'flarum/common/utils/classList';
import username from 'flarum/common/helpers/username';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import { forumBool, isExtensionEnabled, t } from '../../utils/settings';
import { formatViews, viewsLabel } from '../../utils/views';
import TopicViewsMenu from '../../features/stats/views/TopicViewsMenu';
import { discussionLinks, trackClick, type TopicLink } from '../../features/links/data';

export interface TopicMapAttrs extends ComponentAttrs {
  discussion: Discussion;
  /** 'op' abaixo do primeiro post; 'bottom' no fim do tópico. */
  position?: 'op' | 'bottom';
}

/** Quantos avatares cabem na faixa, e quantos posts no menu de curtidas. */
const POSTERS_LIMIT = 5;
const LIKED_LIMIT = 3;
/** A partir de quantas respostas o mapa se repete no fim (o Meta repete em 11). */
const BOTTOM_MIN_REPLIES = 10;

type MenuKey = 'views' | 'likes' | 'links' | 'users';

/** Quantos links o menu "Links populares" mostra antes do "Mostrar mais" (o Discourse mostra 5). */
const LINKS_LIMIT = 5;

function numericAttribute(discussion: Discussion, names: string[]): number | null {
  for (const name of names) {
    const value = discussion.attribute<unknown>(name);

    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }

  return null;
}

/** Todos os posts do tópico, se já estiverem carregados; senão, null. */
function allPosts(discussion: Discussion): Post[] | null {
  const posts: Post[] = [];

  for (const id of discussion.postIds()) {
    const post = app.store.getById<Post>('posts', id);

    if (!post) return null;

    posts.push(post);
  }

  return posts;
}

/** Os posts já carregados (para os avatares, que podem ser parciais). */
function loadedPosts(discussion: Discussion): Post[] {
  return discussion
    .postIds()
    .map((id) => app.store.getById<Post>('posts', id))
    .filter((post): post is Post => !!post);
}

const VIEW_ATTRIBUTES = ['viewCount', 'views', 'view_count'];

/** Sem respostas nem visualizações o mapa só repetiria o cabeçalho do post. */
export function hasTopicMap(discussion: Discussion): boolean {
  return discussion.replyCount() > 0 || numericAttribute(discussion, VIEW_ATTRIBUTES) !== null;
}

export function hasBottomTopicMap(discussion: Discussion): boolean {
  return discussion.replyCount() >= BOTTOM_MIN_REPLIES;
}

function likesOf(post: Post): number {
  return Number(post.attribute('likesCount')) || 0;
}

/** Quem mais postou, primeiro; empate fica com quem postou antes. */
function posters(posts: Post[]): { user: User; count: number }[] {
  const counts = new Map<User, number>();

  posts.forEach((post) => {
    const user = post.user();
    if (user) counts.set(user, (counts.get(user) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([user, count]) => ({ user, count }))
    .sort((a, b) => b.count - a.count);
}

export default class TopicMap extends Component<TopicMapAttrs> {
  open: MenuKey | null = null;
  closer?: (event: Event) => void;

  onremove(vnode: Mithril.VnodeDOM<TopicMapAttrs, this>) {
    super.onremove(vnode);
    this.unlisten();
  }

  view() {
    const discussion = this.attrs.discussion;
    const position = this.attrs.position || 'op';
    const views = numericAttribute(discussion, VIEW_ATTRIBUTES);

    const posts = allPosts(discussion);
    const comments = posts ? posts.filter((post) => post.contentType() === 'comment' && !post.isHidden()) : null;
    const users = numericAttribute(discussion, ['participantCount', 'participantsCount']) ?? (comments ? posters(comments).length : null);
    const likes =
      numericAttribute(discussion, ['canelaLikeCount']) ??
      (comments && isExtensionEnabled('flarum-likes') ? comments.reduce((sum, post) => sum + likesOf(post), 0) : null);

    const visible = loadedPosts(discussion).filter((post) => post.contentType() === 'comment' && !post.isHidden());
    const top = posters(visible);

    const stats: Mithril.Children[] = [];

    // `minViewsCount` do Discourse: o tópico aberto agora nunca tem zero
    // visualizações. O número abre o gráfico "Visualizações recentes" quando
    // as visualizações são as do tema (o recurso stats tem os dias).
    const shownViews = views === null ? null : Math.max(views, 1);
    const viewsMenu = forumBool('canelaStatsViewsEnabled', false) ? 'views' : undefined;

    if (shownViews !== null) stats.push(this.stat('views', shownViews, viewsLabel(shownViews), viewsMenu));
    if (likes) stats.push(this.stat('likes', likes, t('topic.map.likes', { count: likes }), 'likes'));

    // "N links" entre curtidas e usuários, como no Discourse (recurso `links`).
    const links = discussionLinks(discussion);
    if (links && links.total > 0) stats.push(this.stat('links', links.total, t('topic.map.links', { count: links.total }), 'links'));
    if (users !== null && users > 0) stats.push(this.stat('users', users, t('topic.map.users', { count: users }), 'users'));
    if (users === null) {
      const replies = discussion.replyCount();
      stats.push(this.stat('replies', replies, t('topic.map.replies', { count: replies })));
    }

    return (
      <section className={classList('CanelaTopicMap', `CanelaTopicMap--${position}`)} aria-label={t('topic.map.aria_label')}>
        <div className={classList('CanelaTopicMap-stats', { 'CanelaTopicMap-stats--single': stats.length === 1 })}>
          {stats}

          {top.length > 1 && (
            <div className="CanelaTopicMap-users">
              {top.slice(0, POSTERS_LIMIT).map(({ user, count }) => (
                <Link
                  className="CanelaTopicMap-poster"
                  href={app.route.user(user)}
                  title={`${user.displayName()}: ${t('topic.map.posts', { count })}`}
                >
                  <Avatar user={user} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {this.open === 'views' && shownViews !== null && this.viewsMenu(discussion, shownViews)}
        {this.open === 'likes' && this.likesMenu(visible)}
        {this.open === 'links' && links && this.linksMenu(discussion, links.top)}
        {this.open === 'users' && this.usersMenu(top)}
      </section>
    );
  }

  stat(key: string, value: number, label: string, menu?: MenuKey): Mithril.Children {
    const content = [
      // O `dNumber … noTitle` do Discourse: 1,2k, 120k, 1,0M.
      <span className="CanelaTopicMap-number number">{formatViews(value)}</span>,
      <span className="CanelaTopicMap-label">{label}</span>,
    ];

    if (!menu) return <div className={`CanelaTopicMap-stat CanelaTopicMap-stat--${key}`}>{content}</div>;

    return (
      <button
        type="button"
        className={classList('CanelaTopicMap-stat', `CanelaTopicMap-stat--${key}`, { active: this.open === menu })}
        aria-expanded={this.open === menu ? 'true' : 'false'}
        onclick={(event: MouseEvent) => this.toggle(menu, event.currentTarget as HTMLElement)}
      >
        {content}
      </button>
    );
  }

  toggle(menu: MenuKey, trigger: HTMLElement) {
    if (this.open === menu) {
      this.close();
      return;
    }

    this.unlisten();
    this.open = menu;
    this.anchorLeft = trigger.offsetLeft;

    // Fecha ao clicar fora ou com Esc, como os menus do Discourse.
    this.closer = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== 'Escape') return;
      if (event.type === 'mousedown' && (event.target as HTMLElement).closest?.('.CanelaTopicMap-menu, .CanelaTopicMap-stat')) return;

      this.close();
      m.redraw();
    };

    document.addEventListener('mousedown', this.closer, true);
    document.addEventListener('keydown', this.closer, true);
  }

  anchorLeft = 0;

  close() {
    this.open = null;
    this.unlisten();
  }

  unlisten() {
    if (!this.closer) return;

    document.removeEventListener('mousedown', this.closer, true);
    document.removeEventListener('keydown', this.closer, true);
    this.closer = undefined;
  }

  menu(className: string, title: string, body: Mithril.Children): Mithril.Children {
    return (
      <div className={classList('CanelaTopicMap-menu', className)} role="dialog" aria-label={title} style={{ left: `${this.anchorLeft}px` }}>
        <h3 className="CanelaTopicMap-menuTitle">{title}</h3>
        {body}
      </div>
    );
  }

  /** "Visualizações recentes": o gráfico por dia (ou os números, com até dois dias). */
  viewsMenu(discussion: Discussion, views: number): Mithril.Children {
    return this.menu(
      'CanelaTopicMap-menu--views topic-map__views-content',
      t('stats.views.menu_title'),
      <TopicViewsMenu discussion={discussion} views={views} />
    );
  }

  /** As respostas mais curtidas (o primeiro post não conta, como no Discourse). */
  likesMenu(posts: Post[]): Mithril.Children {
    const liked = posts
      .filter((post) => post.number() > 1 && likesOf(post) > 0)
      .sort((a, b) => likesOf(b) - likesOf(a) || a.number() - b.number())
      .slice(0, LIKED_LIMIT);

    return this.menu(
      'CanelaTopicMap-menu--likes',
      t('topic.map.most_liked'),
      <ul className="CanelaTopicMap-liked">
        {liked.map((post) => (
          <li>
            <Link href={app.route.post(post)} onclick={() => this.close()}>
              <span className="CanelaTopicMap-likedUser">
                <Avatar user={post.user() || null} />
                {username(post.user() || null)}
              </span>
              <span className="CanelaTopicMap-likedCount">
                {abbreviateNumber(likesOf(post))}
                <Icon name="fas fa-heart" />
              </span>
              <p className="CanelaTopicMap-likedExcerpt">{post.contentPlain()?.slice(0, 200)}</p>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  /** Mostra todos os links no menu, e não só os primeiros. */
  allLinks = false;

  /** "Links populares": cliques, título (ou endereço) e domínio, os mais clicados primeiro. */
  linksMenu(discussion: Discussion, links: TopicLink[]): Mithril.Children {
    const shown = this.allLinks ? links : links.slice(0, LINKS_LIMIT);

    return this.menu('CanelaTopicMap-menu--links', t('topic.map.popular_links'), [
      <ul className="CanelaTopicMap-links">
        {shown.map((link) => (
          <li className="CanelaTopicMap-link">
            {/* Uma coluna fixa para os títulos alinharem com ou sem cliques. */}
            <span className="CanelaTopicMap-linkCount">
              {link.clicks > 0 && (
                <span className="CanelaTopicMap-linkClicks badge clicks" title={t('links.clicks', { count: link.clicks })}>
                  {formatViews(link.clicks)}
                </span>
              )}
            </span>
            <a
              className="CanelaTopicMap-linkTitle"
              href={link.url}
              target="_blank"
              rel="noopener nofollow ugc"
              title={link.url}
              onclick={() => trackClick(link.postId, link.url, discussion)}
              onauxclick={(event: MouseEvent) => event.button === 1 && trackClick(link.postId, link.url, discussion)}
            >
              {link.title || link.url.replace(/^https?:\/\//, '')}
            </a>
            <span className="CanelaTopicMap-linkDomain">{link.domain.replace(/^www\./, '')}</span>
          </li>
        ))}
      </ul>,
      links.length > LINKS_LIMIT && !this.allLinks ? (
        <button type="button" className="Button Button--link CanelaTopicMap-linksMore" onclick={() => (this.allLinks = true)}>
          {t('topic.map.show_more_links')}
        </button>
      ) : null,
    ]);
  }

  usersMenu(top: { user: User; count: number }[]): Mithril.Children {
    return this.menu(
      'CanelaTopicMap-menu--users',
      t('topic.map.frequent_posters'),
      <div className="CanelaTopicMap-usersList">
        {top.slice(0, 24).map(({ user, count }) => (
          <Link className="CanelaTopicMap-poster" href={app.route.user(user)} title={user.displayName()} onclick={() => this.close()}>
            <Avatar user={user} />
            {count > 1 && <span className="CanelaTopicMap-postCount">{count}</span>}
          </Link>
        ))}
      </div>
    );
  }
}
