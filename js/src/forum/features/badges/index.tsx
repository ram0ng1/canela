/*
 * Emblemas e níveis de confiança no fórum:
 *
 * - "Emblemas" no menu "Mais" da barra lateral (/badges);
 * - a aba "Emblemas" do perfil e o nível de confiança no cartão do perfil;
 * - emblemas de destaque no cartão do usuário (o popover dos posts) e os
 *   "Melhores emblemas" na aba Resumo;
 * - "Alterar nível de confiança…" nos controles de moderação (admin);
 * - a notificação "Ganhou …" nas preferências de notificação.
 *
 * As configurações do fórum são lidas dentro de cada extensão (na hora de
 * desenhar), e não aqui: no initializer o `app.forum` ainda não existe.
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import UserPage from 'flarum/forum/components/UserPage';
import UserCard from 'flarum/forum/components/UserCard';
import UserControls from 'flarum/forum/utils/UserControls';
import Button from 'flarum/common/components/Button';
import LinkButton from 'flarum/common/components/LinkButton';
import type ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';

import CanelaSidebar from '../../components/CanelaSidebar';
import UserSummaryPage from '../../user/UserSummaryPage';
import UserStats from '../../user/UserStats';
import FeaturedBadges from './components/FeaturedBadges';
import SummaryBadges from './components/SummaryBadges';
import { badgesEnabled, trustLevel, trustLevelName, trustLevelsEnabled } from './utils';
import { forumBool, t } from '../../utils/settings';

// O modal vai num chunk próprio: só a moderação o abre.
const openTrustLevelModal = (user: User) => app.modal.show(() => import('./components/TrustLevelModal'), { user });

export { default as FeaturedBadges } from './components/FeaturedBadges';
export { default as BadgeMedal } from './components/BadgeMedal';

function isProfileHero(card: any): boolean {
  return /\bUserHero\b/.test(card.attrs?.className || '');
}

export default function installBadges() {
  extend(CanelaSidebar.prototype, 'moreItems', function (items: ItemList<Mithril.Children>) {
    if (!badgesEnabled()) return;

    items.add(
      'badges',
      <LinkButton href={app.route('canela.badges')} icon="fas fa-certificate">
        {t('badges.nav')}
      </LinkButton>,
      85
    );
  });

  extend(UserPage.prototype, 'navItems', function (this: UserPage, items: ItemList<Mithril.Children>) {
    if (!this.user || !badgesEnabled()) return;

    items.add(
      'badges',
      <LinkButton href={app.route('canela.user.badges', { username: this.user.slug() })} icon="fas fa-certificate">
        {t('badges.nav')}
      </LinkButton>,
      20
    );
  });

  // O nível na linha de estatísticas do perfil ("Nível de confiança regular"),
  // como no Discourse; os emblemas de destaque só no popover — no perfil, a
  // aba Emblemas já está logo abaixo.
  extend(UserStats.prototype, 'items', function (this: UserStats, items: ItemList<Mithril.Children>) {
    const level = trustLevel(this.attrs.user);

    if (!trustLevelsEnabled() || level === null) return;

    items.add('trustLevel', this.stat(t('badges.trust_level'), <span className="CanelaTrustLevel">{trustLevelName(level)}</span>), 50);
  });

  extend(UserCard.prototype, 'contentItems', function (this: any, items: ItemList<Mithril.Children>) {
    if (isProfileHero(this) || !badgesEnabled() || !forumBool('canelaBadgesUserCard', true)) return;

    const user: User = this.attrs.user;

    items.add('canelaBadges', <FeaturedBadges user={user} />, -10);
  });

  extend(UserSummaryPage.prototype, 'sectionItems', function (this: UserSummaryPage, items: ItemList<Mithril.Children>) {
    if (!this.user || !badgesEnabled() || !forumBool('canelaBadgesSummary', true)) return;

    items.add('badges', <SummaryBadges user={this.user} />, 85);
  });

  extend(UserControls, 'moderationControls', function (items: ItemList<Mithril.Children>, user: User) {
    if (!app.session.user?.isAdmin() || !trustLevelsEnabled() || trustLevel(user) === null) return;

    items.add(
      'canelaTrustLevel',
      <Button icon="fas fa-shield-halved" onclick={() => openTrustLevelModal(user)}>
        {t('badges.trust_level_modal.control')}
      </Button>
    );
  });

  // Pelo nome do módulo: o NotificationGrid vem no pedaço da página de
  // configurações, carregado sob demanda — no boot a classe ainda não existe.
  extend('flarum/forum/components/NotificationGrid' as any, 'notificationTypes', function (items: ItemList<any>) {
    if (!badgesEnabled()) return;

    items.add('canelaBadgeGranted', {
      name: 'canelaBadgeGranted',
      icon: 'fas fa-certificate',
      label: t('badges.notification_setting'),
    });
  });
}
