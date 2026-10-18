import Component, { type ComponentAttrs } from 'flarum/common/Component';
import Link from 'flarum/common/components/Link';
import classList from 'flarum/common/utils/classList';

import BadgeMedal from './BadgeMedal';
import type Badge from '../models/Badge';
import { badgeUrl } from '../utils';

export interface BadgeChipAttrs extends ComponentAttrs {
  className?: string;
  badge: Badge;
  username?: string;
  count?: number;
}

/** O emblema em pílula (medalha pequena + nome): o cartão do usuário e o resumo. */
export default class BadgeChip extends Component<BadgeChipAttrs> {
  view() {
    const { badge, username, count, className } = this.attrs;

    return (
      <Link
        className={classList('CanelaBadgeChip', `CanelaBadgeChip--${badge.type()}`, className)}
        href={badgeUrl(badge, username)}
        title={badge.description() || undefined}
      >
        <BadgeMedal badge={badge} size="small" />
        <span className="CanelaBadgeChip-name">{badge.name()}</span>
        {!!count && count > 1 && <span className="CanelaBadgeChip-count">×{count}</span>}
      </Link>
    );
  }
}
