/*
 * O que faltava na barra lateral:
 *
 * - "Revisar" na seção da comunidade, para a moderação, com o número de
 *   sinalizações pendentes (a fila do flarum/flags);
 * - "FAQ", "Termos de serviço" e "Privacidade" no menu "Mais", quando o
 *   admin informa os endereços;
 * - uma seção personalizada de links,
 *   escrita pelo admin, uma linha por link: "Rótulo | endereço | ícone".
 */
import app from 'flarum/forum/app';
import { extend } from 'flarum/common/extend';
import LinkButton from 'flarum/common/components/LinkButton';
import listItems from 'flarum/common/helpers/listItems';
import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';

import CanelaSidebar from '../components/CanelaSidebar';
import SidebarSection from '../components/SidebarSection';
import { forumString } from './settings';
import { isExtensionEnabled, t } from '../utils/settings';
import { chatReviewCount, chatReviewOn } from '../thirdparty/ramonChat/features/flags';

interface CustomLink {
  label: string;
  href: string;
  icon: string;
}

/** Endereço de outro site: abre numa aba nova. Os do próprio fórum, na mesma. */
function isForeign(href: string): boolean {
  if (!/^https?:\/\//i.test(href)) return false;

  try {
    return new URL(href).host !== window.location.host;
  } catch {
    return true;
  }
}

/** Lê a configuração de links personalizados; linhas mal formadas ficam de fora. */
export function customLinks(): CustomLink[] {
  return forumString('canelaSidebarCustomLinks')
    .split(/\r?\n/)
    .map((line) => line.split('|').map((part) => part.trim()))
    .filter(([label, href]) => !!label && !!href && /^(https?:\/\/|\/)/i.test(href))
    .map(([label, href, icon]) => ({
      label,
      href,
      icon: icon && /^fa[a-z-]*\s+fa-[a-z0-9-]+$/i.test(icon) ? icon : 'fas fa-link',
    }));
}

/**
 * Os links do admin são endereços livres, não rotas do app: navegam como
 * links comuns (external), e os de outros sites abrem numa aba nova.
 */
function link(href: string, icon: string, label: string): Mithril.Children {
  const foreign = isForeign(href);

  return (
    <LinkButton href={href} icon={icon} external={true} target={foreign ? '_blank' : undefined} rel={foreign ? 'noopener noreferrer' : undefined}>
      {label}
    </LinkButton>
  );
}

export default function installSidebarGaps(): void {
  extend(CanelaSidebar.prototype, 'communityItems', function (items: ItemList<Mithril.Children>) {
    const user = app.session.user;

    // Quem vê as sinalizações de posts, ou quem modera o chat: as denúncias do
    // ramon/chat entram na mesma fila (thirdparty/ramonChat/features), e o
    // número soma as duas (sem contar duas vezes: ver chatReviewCount).
    if (!user || !isExtensionEnabled('flarum-flags') || !(app.forum.attribute<boolean>('canViewFlags') || chatReviewOn())) return;

    const pending = Number(user.attribute<number>('newFlagCount') || 0) + chatReviewCount();

    items.add(
      'canelaReview',
      <LinkButton href={app.route('flags')} icon="fas fa-flag">
        {t('gaps.sidebar.review')}
        {pending > 0 && <span className="CanelaSidebar-suffix CanelaSidebar-count">{pending}</span>}
      </LinkButton>,
      52
    );
  });

  extend(CanelaSidebar.prototype, 'moreItems', function (items: ItemList<Mithril.Children>) {
    const faq = forumString('canelaSidebarFaqUrl');
    const tos = forumString('canelaSidebarTosUrl');
    const privacy = forumString('canelaSidebarPrivacyUrl');

    // Logo depois de "Sobre" (75).
    if (faq) items.add('canelaFaq', link(faq, 'fas fa-circle-question', t('gaps.sidebar.faq')), 74.5);
    if (tos) items.add('canelaTos', link(tos, 'fas fa-file-contract', t('gaps.sidebar.tos')), 20);
    if (privacy) items.add('canelaPrivacy', link(privacy, 'fas fa-user-shield', t('gaps.sidebar.privacy')), 19);
  });

  extend(CanelaSidebar.prototype, 'sectionItems', function (items: ItemList<Mithril.Children>) {
    const links = customLinks();

    if (!links.length) return;

    const list = new ItemList<Mithril.Children>();

    links.forEach((entry, index) => list.add(`custom${index}`, link(entry.href, entry.icon, entry.label), 100 - index));

    // Entre a comunidade (90) e as categorias (80).
    items.add(
      'canelaCustom',
      <SidebarSection name="custom" title={forumString('canelaSidebarCustomTitle') || t('gaps.sidebar.custom_title')}>
        {listItems(list.toArray())}
      </SidebarSection>,
      85
    );
  });
}
