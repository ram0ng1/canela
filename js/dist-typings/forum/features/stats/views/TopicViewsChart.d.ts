import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import type { ViewStat } from './viewStats';
interface Point {
    x: number;
    y: number;
}
export interface TopicViewsChartAttrs extends ComponentAttrs {
    stats: ViewStat[];
}
export default class TopicViewsChart extends Component<TopicViewsChartAttrs> {
    width: number;
    hover: number | null;
    resize?: () => void;
    measurer?: CanvasRenderingContext2D | null;
    oncreate(vnode: Mithril.VnodeDOM<TopicViewsChartAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<TopicViewsChartAttrs, this>): void;
    /** O Chart.js é "responsive": a largura é a do menu, a altura a metade (aspectRatio 2). */
    measure(): boolean;
    textWidth(text: string): number;
    view(): JSX.Element;
    chart(stats: ViewStat[]): Mithril.Children;
    /** A dica do Chart.js: caixa escura de cantos arredondados, título em negrito e o quadradinho da cor. */
    tooltip(point: Point, x: number, y: number, width: number, height: number, predictedLabel: boolean, predictedColor: boolean): Mithril.Children;
}
export {};
