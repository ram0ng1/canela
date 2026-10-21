/*
 * As abas do topo das páginas Sobre e Diretrizes (Sobre, Diretrizes, Termos de Serviço, Política de Privacidade). Cada aba só existe
 * quando há conteúdo: as Diretrizes com o recurso ligado, Termos e
 * Privacidade com um endereço (do fof/terms ou do admin do tema). As outras
 * políticas do fof/terms entram depois, com o próprio nome. Entre Diretrizes
 * e Termos ficam as páginas do fof/pages que o admin acrescentou à área.
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

/** Uma aba extra (atributo `canelaAboutPages` do fórum, já filtrado pela visibilidade). */
export interface AboutPageTab {
  id: number;
  label: string;
  slug: string;
  icon: string;
}

export function legalPages(): LegalPage[] {
  const pages = app.forum.attribute<LegalPage[] | undefined>('canelaLegalPages');

  return Array.isArray(pages) ? pages.filter((page) => page && typeof page.url === 'string' && page.url) : [];
}

export function aboutPages(): AboutPageTab[] {
  const pages = app.forum?.attribute<AboutPageTab[] | undefined>('canelaAboutPages');

  return Array.isArray(pages) ? pages.filter((page) => page && Number(page.id) > 0) : [];
}

export function findAboutPage(id: number): AboutPageTab | undefined {
  return aboutPages().find((page) => Number(page.id) === id);
}

/** O nome da aba ativa de uma página extra (cada uma tem o seu). */
export function aboutPageTab(id: number): string {
  return `canela.about_page:${id}`;
}

export function aboutPageUrl(page: AboutPageTab): string {
  return app.route('canela.about_page', { page: page.slug ? `${page.id}-${page.slug}` : String(page.id) });
}

export function guidelinesEnabled(): boolean {
  return forumBool('canelaGuidelinesEnabled', false);
}

function isActive(routeName: string, active: string): boolean {
  return routeName === active || (active === 'canela.guidelines' && routeName === 'canela.faq');
}

export default function AboutNav(active: string): Mithril.Children {
  const tabs: Mithril.Children[] = [];

  const internal = (tab: string, href: string, label: string, icon?: string) => (
    <li className={isActive(tab, active) ? 'active' : ''}>
      <LinkButton href={href} active={isActive(tab, active)} icon={icon || undefined}>
        {label}
      </LinkButton>
    </li>
  );

  if (forumBool('canelaAboutEnabled', true)) tabs.push(internal('canela.about', app.route('canela.about'), t('community.about.title')));
  if (guidelinesEnabled()) tabs.push(internal('canela.guidelines', app.route('canela.guidelines'), t('community.guidelines.title')));

  aboutPages().forEach((page) => tabs.push(internal(aboutPageTab(Number(page.id)), aboutPageUrl(page), page.label, page.icon)));

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
