import type Group from 'flarum/common/models/Group';
import type Mithril from 'mithril';
import CommunityPage from './CommunityPage';
/**
 * A lista de grupos (/g): um cartão por grupo, com o símbolo, o
 * nome e quantos membros tem.
 *
 * Os grupos já vêm no payload do fórum — só os que o ator pode ver —, então a
 * página não faz requisição nenhuma.
 */
export default class GroupsPage extends CommunityPage {
    title(): string;
    className(): string;
    enabled(): boolean;
    /** O filtro por nome do topo (`groups-header-filters`), só no navegador. */
    filter: string;
    content(): Mithril.Children;
    /**
     * O cartão do grupo: o flair redondo, o nome grande com o
     * @endereço embaixo, os membros no canto e, no pé, a situação de entrada —
     * no Flarum só a administração põe gente nos grupos, então todos são
     * "Fechado".
     */
    card(group: Group): Mithril.Children;
}
