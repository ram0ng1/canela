import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type { ViewStat } from './viewStats';
export interface TopicViewsAttrs extends ComponentAttrs {
    stats: ViewStat[];
}
export default class TopicViews extends Component<TopicViewsAttrs> {
    view(): JSX.Element;
}
