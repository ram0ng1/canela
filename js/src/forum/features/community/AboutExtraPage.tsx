import app from 'flarum/forum/app';

import { aboutPageTab, findAboutPage } from './AboutNav';
import RulesPage, { type RulesPayload } from './RulesPage';
import { t } from '../../utils/settings';

/**
 * Uma aba extra da área Sobre (/about/{id-slug}): uma página do fof/pages
 * escolhida no admin, no mesmo layout das Diretrizes. O id vem na frente do
 * parâmetro, como no /d/{id} do core; o slug é só enfeite.
 */
export default class AboutExtraPage extends RulesPage {
  pageId(): number {
    const match = /^(\d+)/.exec(String(m.route.param('page') || ''));

    return match ? Number(match[1]) : 0;
  }

  title(): string {
    return findAboutPage(this.pageId())?.label || t('community.about.title');
  }

  className(): string {
    return 'CanelaAboutExtraPage';
  }

  /** Só as páginas da lista do admin que o fof/pages deixa a pessoa ver. */
  enabled(): boolean {
    return !!findAboutPage(this.pageId());
  }

  endpoint(): string {
    return `/canela-about-pages/${this.pageId()}`;
  }

  activeTab(): string {
    return aboutPageTab(this.pageId());
  }

  loaded(data: RulesPayload): void {
    if (data?.title) app.setTitle(data.title);
  }
}
