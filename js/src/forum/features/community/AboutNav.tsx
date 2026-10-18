/*
 * As abas do topo das páginas Sobre e Diretrizes, como no Discourse (Sobre,
 * Diretrizes, Termos de Serviço, Política de Privacidade). Cada aba só existe
 * quando há conteúdo: as Diretrizes com o recurso ligado, Termos e
 * Privacidade com um endereço (do fof/terms ou do admin do tema). As outras
 * políticas do fof/terms entram depois, com o próprio nome.
 */
import app from 'flarum/forum/app';
import LinkButton from 'flarum/common/components/LinkButton';
import type Mithril from 'mithril';

import { forumBool, t } from '../../utils/settings';

export interface LegalPage {
  key: string;
  title: string | null;
  url: string;
}

export function legalPages(): LegalPage[] {
  const pages = app.forum.attribute<LegalPage[] | undefined>('canelaLegalPages');

  return Array.isArray(pages) ? pages.filter((page) => page && typeof page.url === 'string' && page.url) : [];
}

export function guidelinesEnabled(): boolean {
  return forumBool('canelaGuidelinesEnabled', false);
}

function isActive(routeName: string, active: string): boolean {
  return routeName === active || (active === 'canela.guidelines' && routeName === 'canela.faq');
}

export default function AboutNav(active: string): Mithril.Children {
  const tabs: Mithril.Children[] = [];

  const internal = (routeName: string, label: string) => (
    <li className={isActive(routeName, active) ? 'active' : ''}>
      <LinkButton href={app.route(routeName)} active={isActive(routeName, active)}>
        {label}
      </LinkButton>
    </li>
  );

  if (forumBool('canelaAboutEnabled', true)) tabs.push(internal('canela.about', t('community.about.title')));
  if (guidelinesEnabled()) tabs.push(internal('canela.guidelines', t('community.guidelines.title')));

  legalPages().forEach((page) => {
    const label = page.key === 'tos' ? t('community.legal.tos') : page.key === 'privacy' ? t('community.legal.privacy') : page.title || page.url;
    const external = /^https?:\/\//i.test(page.url);

    tabs.push(
      <li className={`CanelaAbout-navLegal CanelaAbout-navLegal--${page.key}`}>
        <a href={page.url} {...(external ? { target: '_blank', rel: 'noopener' } : {})}>
          {label}
        </a>
      </li>
    );
  });

  // Uma aba sozinha não é navegação.
  if (tabs.length < 2) return null;

  return (
    <nav className="CanelaAbout-nav">
      <ul>{tabs}</ul>
    </nav>
  );
}
