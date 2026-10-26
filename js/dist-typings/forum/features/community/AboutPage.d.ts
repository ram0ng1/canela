import ItemList from 'flarum/common/utils/ItemList';
import type Mithril from 'mithril';
import CommunityPage from './CommunityPage';
import { type AboutPayload } from './api';
/**
 * A página "Sobre" (/about): o fórum, o que o admin escreveu
 * sobre ele, como falar com a equipe, quem é a equipe e os números do site.
 */
export default class AboutPage extends CommunityPage {
    data: AboutPayload | null;
    failed: boolean;
    oninit(vnode: Mithril.Vnode<any, this>): void;
    title(): string;
    className(): string;
    enabled(): boolean;
    load(): void;
    content(): Mithril.Children;
    sectionItems(): ItemList<Mithril.Children>;
    /**
     * Os dados ainda vindo: as duas colunas com as classes das reais (a faixa
     * de números, a equipe com o cartão do usuário e a atividade do site à
     * direita), com os títulos já conhecidos e barras de texto no lugar do
     * resto: o conteúdo chega onde o esqueleto estava.
     */
    skeleton(): Mithril.Children;
    /** As abas do topo (Sobre, Diretrizes, Termos, Privacidade), o nome do fórum e a descrição. */
    header(): Mithril.Children;
    /** A faixa de números logo abaixo do título: membros, equipe e idade do fórum. */
    summary(data: AboutPayload): Mithril.Children;
    summaryItem(icon: string, text: string, title?: string): Mithril.Children;
    leftItems(data: AboutPayload): ItemList<Mithril.Children>;
    staffSection(name: string, title: string, ids: string[]): Mithril.Children;
    rightItems(data: AboutPayload): ItemList<Mithril.Children>;
    contact(data: AboutPayload): Mithril.Children;
    /** "Atividade do site": a coluna de números da semana. */
    activity(stats: NonNullable<AboutPayload['stats']>): Mithril.Children;
    statsTable(stats: NonNullable<AboutPayload['stats']>): Mithril.Children;
}
