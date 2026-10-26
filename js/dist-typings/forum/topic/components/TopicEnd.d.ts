import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
export interface TopicEndAttrs extends ComponentAttrs {
    discussion: Discussion;
    stream: any;
    page: any;
}
export default class TopicEnd extends Component<TopicEndAttrs> {
    view(): JSX.Element | null;
}
