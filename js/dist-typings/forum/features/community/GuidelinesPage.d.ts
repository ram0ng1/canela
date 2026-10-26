import RulesPage from './RulesPage';
/**
 * As "Diretrizes" (/guidelines, e /faq como apelido): a página do fof/pages
 * escolhida no admin, ou o texto do tema, no layout de regras.
 */
export default class GuidelinesPage extends RulesPage {
    title(): string;
    className(): string;
    enabled(): boolean;
    endpoint(): string;
    activeTab(): string;
}
