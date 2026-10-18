import Link from 'flarum/common/components/Link';
import Icon from 'flarum/common/components/Icon';
import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';

import CommunityPage from './CommunityPage';
import GroupFlair from './GroupFlair';
import { communityGroups, groupsEnabled, groupSlug, groupUrl, memberCount } from './groups';
import { t } from '../../utils/settings';

/**
 * A lista de grupos do Discourse (/g): um cartão por grupo, com o símbolo, o
 * nome e quantos membros tem.
 *
 * Os grupos já vêm no payload do fórum — só os que o ator pode ver —, então a
 * página não faz requisição nenhuma.
 */
export default class GroupsPage extends CommunityPage {
  title(): string {
    return t('community.groups.title');
  }

  className(): string {
    return 'CanelaGroupsPage';
  }

  enabled(): boolean {
    return groupsEnabled();
  }

  /** O filtro por nome do topo (`groups-header-filters`), só no navegador. */
  filter = '';

  content(): Mithril.Children {
    const query = this.filter.trim().toLowerCase();
    const groups = communityGroups().filter(
      (group) => !query || [group.namePlural(), group.nameSingular(), groupSlug(group)].some((name) => (name || '').toLowerCase().includes(query))
    );

    return (
      <div className="CanelaGroups">
        <h1 className="sr-only">{t('community.groups.title')}</h1>
        <div className="CanelaGroups-header">
          <input
            className="FormControl CanelaGroups-filter"
            type="search"
            placeholder={t('community.groups.filter_placeholder')}
            aria-label={t('community.groups.filter_placeholder')}
            value={this.filter}
            oninput={(event: InputEvent) => (this.filter = (event.target as HTMLInputElement).value)}
          />
        </div>
        {groups.length ? (
          <ul className="CanelaGroups-grid">{groups.map((group) => this.card(group))}</ul>
        ) : (
          <p className="CanelaCommunity-empty">{t('community.groups.empty')}</p>
        )}
      </div>
    );
  }

  /**
   * O `group-box` do Discourse: o flair redondo, o nome grande com o
   * @endereço embaixo, os membros no canto e, no pé, a situação de entrada —
   * no Flarum só a administração põe gente nos grupos, então todos são
   * "Fechado".
   */
  card(group: Group): Mithril.Children {
    const count = memberCount(group);

    return (
      <li key={group.id()} className="CanelaGroups-item">
        <Link className="CanelaGroupCard" href={groupUrl(group)} style={group.color() ? { '--group-color': group.color() } : undefined}>
          <span className="CanelaGroupCard-inner">
            <span className="CanelaGroupCard-infoWrapper">
              {group.icon() && <GroupFlair group={group} />}
              <span className="CanelaGroupCard-info">
                <span className="CanelaGroupCard-details">
                  <span className="CanelaGroupCard-name">{group.namePlural()}</span>
                  <span className="CanelaGroupCard-mention">@{groupSlug(group)}</span>
                </span>
                {count !== null && (
                  <span className="CanelaGroupCard-count" title={t('community.groups.members', { count })}>
                    <Icon name="far fa-user" />
                    {count}
                  </span>
                )}
              </span>
            </span>
            <span className="CanelaGroupCard-membership">
              {group.isHidden() ? (
                <span className="CanelaGroupCard-hidden">
                  <Icon name="far fa-eye-slash" /> {t('community.groups.hidden')}
                </span>
              ) : (
                <span>
                  <Icon name="fas fa-ban" /> {t('community.groups.closed')}
                </span>
              )}
            </span>
          </span>
        </Link>
      </li>
    );
  }
}
