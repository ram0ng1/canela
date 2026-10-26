import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Discussion from 'flarum/common/models/Discussion';
import type Mithril from 'mithril';
interface RelatedTopic {
    id: string;
    title: string;
    url: string;
    replyCount: number;
    lastPostedAt: string | null;
    tagIds: string[];
}
export interface RelatedTopicsAttrs extends ComponentAttrs {
    discussion: Discussion;
}
export default class RelatedTopics extends Component<RelatedTopicsAttrs> {
    oninit(vnode: Mithril.Vnode<RelatedTopicsAttrs, this>): void;
    view(): JSX.Element | null;
    row(topic: RelatedTopic): Mithril.Children;
}
export {};
