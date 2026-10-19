import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import BadgeChip from './BadgeChip';
import type UserBadge from '../models/UserBadge';
import { distinctBadges, loadUserBadges } from '../utils';
import { t } from '../../../utils/settings';

export interface FeaturedBadgesAttrs extends ComponentAttrs {
  className?: string;
  user: User;
  /** Quantos emblemas à vista antes do "+N". */
  limit?: number;
}

/**
 * Os emblemas de destaque de alguém, como no cartão do usuário do Discourse:
 * os primeiros na ordem ouro → prata → bronze, e um "+N" que leva à aba
 * Emblemas do perfil. Some por inteiro enquanto carrega e quando não há
 * emblema — um cartão não precisa avisar que alguém ainda não ganhou nada.
 */
export default class FeaturedBadges extends Component<FeaturedBadgesAttrs> {
  userBadges: UserBadge[] | null = null;

  oninit(vnode: Mithril.Vnode<FeaturedBadgesAttrs, this>) {
    super.oninit(vnode);

    loadUserBadges(this.attrs.user).then((userBadges) => {
      this.userBadges = userBadges;
      m.redraw();
    });
  }

  view() {
    if (!this.userBadges?.length) return null;

    const { user, limit = 3, className } = this.attrs;
    const badges = distinctBadges(this.userBadges);
    const shown = badges.slice(0, limit);
    const more = badges.length - shown.length;

    return (
      <div className={classList('CanelaFeaturedBadges', className)}>
        {shown.map(({ badge, count }) => (
          <BadgeChip badge={badge} count={count} username={user.username()} />
        ))}
        {more > 0 && (
          <Link className="CanelaFeaturedBadges-more" href={app.route('canela.user.badges', { username: user.slug() })}>
            {t('badges.more', { count: more })}
          </Link>
        )}
      </div>
    );
  }
}
