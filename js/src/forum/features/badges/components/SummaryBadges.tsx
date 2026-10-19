import app from 'flarum/forum/app';
import Component, { type ComponentAttrs } from 'flarum/common/Component';
import LinkButton from 'flarum/common/components/LinkButton';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import BadgeCard from './BadgeCard';
import type UserBadge from '../models/UserBadge';
import { distinctBadges, loadUserBadges } from '../utils';
import { t } from '../../../utils/settings';

export interface SummaryBadgesAttrs extends ComponentAttrs {
  user: User;
}

/** Quantos cartões no resumo, como os "Melhores emblemas" do Discourse. */
const LIMIT = 6;

/**
 * A seção "Melhores emblemas" da aba Resumo do perfil. Sem emblema
 * nenhum, a seção some: o resumo de quem acabou de chegar não precisa dela.
 */
export default class SummaryBadges extends Component<SummaryBadgesAttrs> {
  userBadges: UserBadge[] | null = null;

  oninit(vnode: Mithril.Vnode<SummaryBadgesAttrs, this>) {
    super.oninit(vnode);

    loadUserBadges(this.attrs.user).then((userBadges) => {
      this.userBadges = userBadges;
      m.redraw();
    });
  }

  view() {
    if (!this.userBadges?.length) return null;

    const user = this.attrs.user;
    const badges = distinctBadges(this.userBadges);

    return (
      <section className="CanelaUserSummary-section CanelaSummaryBadges">
        <h2 className="CanelaUserSummary-heading">{t('badges.summary_heading')}</h2>
        <ul className="CanelaBadges-grid CanelaBadges-grid--compact">
          {badges.slice(0, LIMIT).map(({ badge, count, latest }) => (
            <li key={badge.id()}>
              <BadgeCard badge={badge} username={user.username()} timesGranted={count} grantedAt={latest.grantedAt()} />
            </li>
          ))}
        </ul>
        {badges.length > LIMIT && (
          <LinkButton className="Button Button--link CanelaUserSummary-more" href={app.route('canela.user.badges', { username: user.slug() })}>
            {t('badges.more_badges')}
          </LinkButton>
        )}
      </section>
    );
  }
}
