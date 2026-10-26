import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import { type UpcomingItem } from './model';
export interface UpcomingEventsAttrs extends ComponentAttrs {
    limit?: number;
}
export declare function loadUpcoming(params?: Record<string, string | number>): Promise<UpcomingItem[]>;
export declare function discussionHref(item: UpcomingItem): string;
export default class UpcomingEvents extends Component<UpcomingEventsAttrs> {
    private items;
    oninit(vnode: Mithril.Vnode<UpcomingEventsAttrs, this>): void;
    view(): Mithril.Children;
}
