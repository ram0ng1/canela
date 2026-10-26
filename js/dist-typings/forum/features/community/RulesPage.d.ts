import type Mithril from 'mithril';
import CommunityPage from './CommunityPage';
export interface RulesPayload {
    html: string | null;
    title?: string;
}
/**
 * Base das páginas de regras da área Sobre (as Diretrizes e as páginas extras
 * do fof/pages): título, índice de seções em pílulas e cada seção num cartão.
 * Cada página só diz de onde vem o HTML e qual aba fica ativa.
 */
export default abstract class RulesPage extends CommunityPage {
    html: string | null;
    pageTitle: string | null;
    failed: boolean;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    /** O endereço na API, relativo (`/canela-guidelines`). */
    abstract endpoint(): string;
    /** A aba de AboutNav que fica marcada. */
    abstract activeTab(): string;
    load(): void;
    /** Depois de carregar (a página extra troca o título da aba do navegador). */
    loaded(_data: RulesPayload): void;
    content(): Mithril.Children;
    /**
     * O texto ainda vindo: o título (já conhecido) e dois cartões de regras com
     * as classes dos reais, com barras de texto no lugar das linhas, para o
     * conteúdo chegar onde o esqueleto estava.
     */
    skeleton(): Mithril.Children;
    rules(html: string): Mithril.Children;
}
