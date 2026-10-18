import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import BadgeCard from './BadgeCard';
import type UserBadge from '../models/UserBadge';
import { badgesEnabled, distinctBadges, loadUserBadges, trustLevel, trustLevelName, trustLevelsEnabled } from '../utils';
import { t } from '../../../utils/settings';

/**
 * A aba "Emblemas" do perfil (/u/:username/badges): cada emblema uma vez,
 * com quantas vezes foi ganho e quando, na ordem ouro → prata → bronze.
 */
export default class UserBadgesPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
  userBadges: UserBadge[] | null = null;

  /** O usuário cujos emblemas já foram pedidos: `show()` roda de novo quando o perfil completo chega. */
  private loadedFor: User | null = null;

  oninit(vnode: Mithril.Vnode<Attrs, this>) {
    super.oninit(vnode);

    this.loadUser(m.route.param('username'));
  }

  show(user: User): void {
    super.show(user);

    if (this.loadedFor === user || !badgesEnabled()) return;

    this.loadedFor = user;

    loadUserBadges(user, { refresh: true }).then((userBadges) => {
      this.userBadges = userBadges;
      m.redraw();
    });
  }

  content(): Mithril.Children {
    if (!badgesEnabled()) return <p className="CanelaBadges-empty">{t('badges.unavailable')}</p>;

    const user = this.user!;
    const level = trustLevel(user);

    return (
      <div className="CanelaUserBadges">
        {trustLevelsEnabled() && level !== null && (
          <p className="CanelaUserBadges-level">{t('badges.trust_level_label', { level: trustLevelName(level) })}</p>
        )}
        {this.list(user)}
      </div>
    );
  }

  list(user: User): Mithril.Children {
    if (this.userBadges === null) return <LoadingIndicator display="block" />;

    const badges = distinctBadges(this.userBadges);

    if (!badges.length) return <p className="CanelaBadges-empty">{t('badges.user_none', { username: user.displayName() })}</p>;

    return (
      <ul className="CanelaBadges-grid">
        {badges.map(({ badge, count, latest }) => (
          <li key={badge.id()}>
            <BadgeCard badge={badge} username={user.username()} timesGranted={count} grantedAt={latest.grantedAt()} />
          </li>
        ))}
      </ul>
    );
  }
}
