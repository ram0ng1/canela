/*
 * A linha de estatísticas do perfil do Discourse: "Ingressou 23 fev, 2021",
 * "Última postagem 17 set", "Visto(a) 14 horas"… — rótulo cinza, valor escuro,
 * entre bordas finas.
 *
 * O modelo do usuário não traz a data da última postagem, então ela vem de
 * uma consulta de um post só, guardada por usuário para não repetir a cada
 * redesenho nem a cada aba do perfil.
 */
import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import ItemList from 'flarum/common/utils/ItemList';
import formatNumber from 'flarum/common/utils/formatNumber';
import classList from 'flarum/common/utils/classList';
import Link from 'flarum/common/components/Link';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';

import { fullDate, shortAge, shortDate } from '../utils/dates';
import { forumBool, t } from '../utils/settings';
import { groupsEnabled, groupUrl } from '../features/community/groups';

export interface UserStatsAttrs extends ComponentAttrs {
  user: User;
}

/** id do usuário → data da última postagem (null = nenhuma; Promise = carregando). */
const lastPostCache = new Map<string, Date | null | Promise<void>>();

function loadLastPost(user: User): void {
  const id = user.id();

  if (!id || lastPostCache.has(id) || !user.commentCount()) return;

  const request = app.store
    .find<Post[]>('posts', {
      filter: { author: user.slug(), type: 'comment' },
      sort: '-createdAt',
      // Só a data (o pré-carregamento do Resumo tira este da amostra de respostas).
      fields: { posts: 'number,createdAt,likesCount,discussion' },
      page: { limit: 1, total: 0 },
    } as any)
    .then((posts) => {
      lastPostCache.set(id, posts[0]?.createdAt() ?? null);
    })
    .catch(() => {
      // Sem permissão ou erro de rede: a estatística simplesmente não aparece.
      lastPostCache.set(id, null);
    })
    .finally(() => m.redraw());

  lastPostCache.set(id, request);
}

function cachedLastPost(user: User): Date | null {
  const value = lastPostCache.get(user.id() || '');

  return value instanceof Date ? value : null;
}

export default class UserStats<Attrs extends UserStatsAttrs = UserStatsAttrs> extends Component<Attrs> {
  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    loadLastPost(this.attrs.user);
  }

  view(): Mithril.Children {
    const items = this.items();

    if (items.isEmpty()) return null;

    return <dl className="CanelaUserStats">{items.toArray()}</dl>;
  }

  /** Cada estatística é um item, para outras extensões poderem somar as suas. */
  items(): ItemList<Mithril.Children> {
    const items = new ItemList<Mithril.Children>();
    const user = this.attrs.user;

    const joinTime = user.joinTime();
    if (joinTime) {
      items.add('joined', this.stat(t('user.stats.joined'), shortDate(joinTime), fullDate(joinTime)), 100);
    }

    const lastPost = cachedLastPost(user);
    if (lastPost) {
      items.add('lastPost', this.stat(t('user.stats.last_post'), shortAge(lastPost), fullDate(lastPost)), 90);
    }

    const lastSeenAt = user.lastSeenAt();
    if (lastSeenAt) {
      const online = user.isOnline();

      items.add(
        'lastSeen',
        this.stat(
          t('user.stats.seen'),
          online ? <span className="CanelaUserStats-online">{t('user.stats.online')}</span> : shortAge(lastSeenAt),
          fullDate(lastSeenAt)
        ),
        80
      );
    }

    const posts = user.commentCount();
    if (typeof posts === 'number') {
      items.add('posts', this.stat(t('user.stats.posts'), formatNumber(posts)), 70);
    }

    const discussions = user.discussionCount();
    if (typeof discussions === 'number') {
      items.add('discussions', this.stat(t('user.stats.topics'), formatNumber(discussions)), 60);
    }

    // "Grupos team, plugin_authors…": os nomes separados por vírgula, como
    // links para a página do grupo quando ela existe.
    const groups = ((user.groups() || []) as (Group | undefined)[]).filter((group): group is Group => !!group);
    if (groups.length) {
      const linked = groupsEnabled() && forumBool('canelaGroupsProfileLinks', true);

      items.add(
        'groups',
        this.stat(
          t('user.stats.groups'),
          groups.map((group) =>
            linked ? (
              <Link className="CanelaUserStats-group" href={groupUrl(group)}>
                {group.nameSingular()}
              </Link>
            ) : (
              <span className="CanelaUserStats-group">{group.nameSingular()}</span>
            )
          ),
          undefined,
          'CanelaUserStats-item--groups'
        ),
        40
      );
    }

    return items;
  }

  stat(label: string, value: Mithril.Children, title?: string, className?: string): Mithril.Children {
    return (
      <div className={classList('CanelaUserStats-item', className)} title={title || undefined}>
        <dt>{label}</dt>
        <dd>{value}</dd>
      </div>
    );
  }
}
