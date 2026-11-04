import app from 'flarum/forum/app';

import { aboutPageTab, findAboutPage, findLegalPage, legalLabel } from './AboutNav';
import RulesPage, { type RulesPayload } from './RulesPage';
import { t } from '../../utils/settings';

/**
 * Uma aba extra da área Sobre (/about/{id-slug}): uma página do fof/pages
 * escolhida no admin, ou a de uma política (Termos, Privacidade), no mesmo
 * layout das Diretrizes. O id vem na frente do
 * parâmetro, como no /d/{id} do core; o slug é só enfeite. O conteúdo vem do
 * recurso `canela-about-pages` (GET /api/canela-about-pages/{id}).
 */
export default class AboutExtraPage extends RulesPage {
  pageId(): number {
    const match = /^(\d+)/.exec(String(m.route.param('page') || ''));

    return match ? Number(match[1]) : 0;
  }

  title(): string {
    const legal = findLegalPage(this.pageId());

    return findAboutPage(this.pageId())?.label || (legal ? legalLabel(legal) : t('community.about.title'));
  }

  className(): string {
    return 'CanelaAboutExtraPage';
  }

  /** Só as páginas da lista do admin (ou das políticas) que o fof/pages deixa a pessoa ver. */
  enabled(): boolean {
    return !!findAboutPage(this.pageId()) || !!findLegalPage(this.pageId());
  }

  endpoint(): string {
    return `/canela-about-pages/${this.pageId()}`;
  }

  activeTab(): string {
    return aboutPageTab(this.pageId());
  }

  /** A página vem como recurso `canela-about-pages`: o HTML e o título estão nos atributos. */
  parse(response: unknown): RulesPayload {
    const attributes = (response as { data?: { attributes?: { html?: string; title?: string } } } | null)?.data?.attributes;

    return { html: attributes?.html ?? null, title: attributes?.title };
  }

  loaded(data: RulesPayload): void {
    if (data?.title) app.setTitle(data.title);
  }
}
