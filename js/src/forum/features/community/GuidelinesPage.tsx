import { guidelinesEnabled } from './AboutNav';
import RulesPage from './RulesPage';
import { t } from '../../utils/settings';

/**
 * As "Diretrizes" (/guidelines, e /faq como apelido): a página do fof/pages
 * escolhida no admin, ou o texto do tema, no layout de regras.
 */
export default class GuidelinesPage extends RulesPage {
  title(): string {
    return t('community.guidelines.title');
  }

  className(): string {
    return 'CanelaGuidelinesPage';
  }

  enabled(): boolean {
    return guidelinesEnabled();
  }

  endpoint(): string {
    return '/canela-guidelines';
  }

  activeTab(): string {
    return 'canela.guidelines';
  }
}
