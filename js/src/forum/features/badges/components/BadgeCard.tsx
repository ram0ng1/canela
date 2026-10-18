import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import classList from 'flarum/common/utils/classList';
import formatNumber from 'flarum/common/utils/formatNumber';
import type Mithril from 'mithril';

import type Badge from '../models/Badge';
import { badgeUrl } from '../utils';
import { fullDate, shortDate } from '../../../utils/dates';
import { t } from '../../../utils/settings';

export interface BadgeCardAttrs extends ComponentAttrs {
  className?: string;
  badge: Badge;
  /** Na aba do perfil: de quem é, para o link levar à página com a pessoa em destaque. */
  username?: string;
  /** Quantas vezes a pessoa ganhou (emblemas de concessão múltipla). */
  timesGranted?: number;
  grantedAt?: Date | null;
  /** A pessoa logada tem o emblema (a marca da página /badges). */
  owned?: boolean;
  /** Mostra o "N concedidos" (a página /badges). */
  showCount?: boolean;
}

/**
 * Um emblema em cartão, como o `badge-card` do Discourse: o ícone grande na
 * cor do tipo (ouro, prata, bronze) à esquerda e, ao lado, o nome, a
 * descrição e, conforme o lugar, quantas pessoas o ganharam ou quando a
 * pessoa do perfil o ganhou. O cartão inteiro é o link.
 */
export default class BadgeCard extends Component<BadgeCardAttrs> {
  view() {
    const { badge, username, timesGranted, grantedAt, owned, showCount, className } = this.attrs;
    const type = badge.type() || 'bronze';

    return (
      <Link
        className={classList('CanelaBadgeCard', `CanelaBadgeCard--${type}`, className, { 'CanelaBadgeCard--owned': owned })}
        href={badgeUrl(badge, username)}
      >
        <span className="CanelaBadgeCard-contents">
          <span className={`CanelaBadgeCard-icon CanelaBadgeCard-icon--${type}`} title={t(`badges.types.${type}`)} aria-hidden="true">
            <Icon name={badge.icon() || 'fas fa-certificate'} />
          </span>
          <span className="CanelaBadgeCard-info">
            <span className="CanelaBadgeCard-name">
              {badge.name()}
              {!!timesGranted && timesGranted > 1 && <span className="CanelaBadgeCard-times">×{timesGranted}</span>}
            </span>
            {badge.description() && <span className="CanelaBadgeCard-description">{badge.description()}</span>}
            {this.footer(showCount, grantedAt)}
          </span>
        </span>
        {owned && (
          <span className="CanelaBadgeCard-owned" title={t('badges.owned')}>
            <Icon name="fas fa-check" />
          </span>
        )}
      </Link>
    );
  }

  footer(showCount?: boolean, grantedAt?: Date | null): Mithril.Children {
    if (grantedAt) {
      return (
        <time className="CanelaBadgeCard-meta" datetime={grantedAt.toISOString()} title={fullDate(grantedAt)}>
          {t('badges.granted_on', { date: shortDate(grantedAt) })}
        </time>
      );
    }

    if (showCount) {
      const count = this.attrs.badge.grantCount() || 0;

      return <span className="CanelaBadgeCard-meta">{t('badges.awarded', { count, number: formatNumber(count) })}</span>;
    }

    return null;
  }
}
