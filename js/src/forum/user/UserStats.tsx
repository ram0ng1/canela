/*
 * A linha de estatísticas do perfil: "Ingressou 23 fev, 2021",
 * "Última postagem 17 set", "Visto(a) 14 horas"… — rótulo cinza, valor escuro,
 * entre bordas finas.
 *
 * A data da última postagem vem com o próprio usuário, na resposta do perfil
 * (`canelaLastPostAt`, UserLastPostField): aparece junto com o resto da
 * página, sem um segundo pedido depois dela.
 */
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import ItemList from 'flarum/common/utils/ItemList';
import formatNumber from 'flarum/common/utils/formatNumber';
import classList from 'flarum/common/utils/classList';
import Link from 'flarum/common/components/Link';
import type User from 'flarum/common/models/User';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';

import { fullDate, shortAge, shortDate } from '../utils/dates';
import { forumBool, t } from '../utils/settings';
import { groupsEnabled, groupUrl } from '../features/community/groups';

export interface UserStatsAttrs extends ComponentAttrs {
  user: User;
}

/** A data da última postagem (null: nenhuma, ou o usuário veio de uma lista e o perfil ainda não chegou). */
function lastPostAt(user: User): Date | null {
  const value = user.attribute<string | null>('canelaLastPostAt');

  return value ? new Date(value) : null;
}

export default class UserStats<Attrs extends UserStatsAttrs = UserStatsAttrs> extends Component<Attrs> {
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

    const lastPost = lastPostAt(user);
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

    // "Grupos Moderadores, Admins…": os nomes separados por vírgula, como
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
