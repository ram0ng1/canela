import app from 'flarum/forum/app';
import LoadingIndicator from 'flarum/common/components/LoadingIndicator';
import type Mithril from 'mithril';

import BadgesBasePage from './BadgesBasePage';
import BadgeCard from './BadgeCard';
import type Badge from '../models/Badge';
import { GROUPINGS, LIST_FIELDS, badgesEnabled, loadOwnedBadgeIds } from '../utils';
import { t } from '../../../utils/settings';

/**
 * A página /badges do Discourse: os emblemas em grade, separados por
 * agrupamento (Primeiros passos, Comunidade, Postando, Nível de confiança),
 * cada um com quantas vezes foi concedido. Os que a pessoa logada já tem
 * ganham a marca de conquistado.
 */
export default class BadgesPage extends BadgesBasePage {
  badges: Badge[] | null = null;
  owned = new Set<string>();

  oninit(vnode: Mithril.Vnode<any, this>) {
    super.oninit(vnode);

    if (!badgesEnabled()) return;

    app.store
      .find<Badge[]>('badges', { sort: 'position', fields: { badges: LIST_FIELDS } } as any)
      .then((badges) => (this.badges = badges.slice()))
      .catch(() => (this.badges = []))
      .finally(() => m.redraw());

    const user = app.session.user;

    if (user) {
      loadOwnedBadgeIds(user).then((ids) => {
        this.owned = ids;
        m.redraw();
      });
    }
  }

  title(): string {
    return t('badges.page_title');
  }

  className(): string {
    return 'CanelaBadgesIndex';
  }

  content(): Mithril.Children {
    return (
      <div className="CanelaBadgesPage">
        <h1 className="CanelaBadges-title">{t('badges.page_title')}</h1>
        {this.badges === null ? <LoadingIndicator display="block" /> : this.groups()}
      </div>
    );
  }

  groups(): Mithril.Children {
    const badges = this.badges!;

    if (!badges.length) return <p className="CanelaBadges-empty">{t('badges.none')}</p>;

    // Um agrupamento que não está na lista (emblema criado à mão) cai em "Outros".
    const groupOf = (badge: Badge) => ((GROUPINGS as readonly string[]).includes(badge.grouping()) ? badge.grouping() : 'other');

    // Só os grupos com emblemas: um `null` no meio de itens com `key` faz o
    // Mithril recusar a lista inteira.
    return GROUPINGS.filter((grouping) => badges.some((badge) => groupOf(badge) === grouping)).map((grouping) => {
      const inGroup = badges.filter((badge) => groupOf(badge) === grouping);

      return (
        <section className="CanelaBadges-group" key={grouping}>
          <h2 className="CanelaBadges-groupTitle">{t(`badges.groupings.${grouping}`)}</h2>
          <ul className="CanelaBadges-grid">
            {inGroup.map((badge) => (
              <li key={badge.id()}>
                <BadgeCard badge={badge} showCount owned={this.owned.has(badge.id()!)} />
              </li>
            ))}
          </ul>
        </section>
      );
    });
  }
}
