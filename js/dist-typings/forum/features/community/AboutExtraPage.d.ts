import RulesPage, { type RulesPayload } from './RulesPage';
/**
 * Uma aba extra da área Sobre (/about/{id-slug}): uma página do fof/pages
 * escolhida no admin, no mesmo layout das Diretrizes. O id vem na frente do
 * parâmetro, como no /d/{id} do core; o slug é só enfeite. O conteúdo vem do
 * recurso `canela-about-pages` (GET /api/canela-about-pages/{id}).
 */
export default class AboutExtraPage extends RulesPage {
    pageId(): number;
    title(): string;
    className(): string;
    /** Só as páginas da lista do admin que o fof/pages deixa a pessoa ver. */
    enabled(): boolean;
    endpoint(): string;
    activeTab(): string;
    /** A página vem como recurso `canela-about-pages`: o HTML e o título estão nos atributos. */
    parse(response: unknown): RulesPayload;
    loaded(data: RulesPayload): void;
}
