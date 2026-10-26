import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';
import { type ViewStat, type ViewStatsResponse } from './viewStats';
export interface TopicViewsMenuAttrs extends ComponentAttrs {
    discussion: Discussion;
    /** O total do tópico, para o dia de hoje quando ainda não há dias gravados. */
    views: number;
}
/**
 * Busca os números (e o gráfico) antes do clique, ao passar o mouse ou focar
 * "visualizações": o menu abre já com o conteúdo, sem o carregando que o fazia
 * mudar de tamanho na frente da pessoa.
 */
export declare function prefetchTopicViews(discussion: Discussion, views: number): void;
export default class TopicViewsMenu extends Component<TopicViewsMenuAttrs> {
    data?: ViewStatsResponse;
    loading: boolean;
    failed: boolean;
    oninit(vnode: Mithril.Vnode<TopicViewsMenuAttrs, this>): void;
    /**
     * Os dias do menu. Com dias gravados, a janela inteira (30 dias, ou desde a
     * criação do tópico) com zero nos dias sem registro; sem nenhum, o total
     * em hoje.
     */
    stats(): ViewStat[];
    view(): JSX.Element;
}
