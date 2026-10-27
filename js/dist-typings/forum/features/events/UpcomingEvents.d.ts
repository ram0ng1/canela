import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import { type UpcomingItem } from './model';
export interface UpcomingEventsAttrs extends ComponentAttrs {
    limit?: number;
}
export interface UpcomingParams {
    /** AAAA-MM-DD; sem ela, de agora. */
    from?: string;
    /** AAAA-MM-DD; sem ela, um ano depois de `from`. */
    to?: string;
    /** Quantas ocorrências (não eventos), até 200. */
    limit?: number;
}
export declare function loadUpcoming({ from, to, limit }?: UpcomingParams): Promise<UpcomingItem[]>;
export declare function discussionHref(item: UpcomingItem): string;
export default class UpcomingEvents extends Component<UpcomingEventsAttrs> {
    private items;
    oninit(vnode: Mithril.Vnode<UpcomingEventsAttrs, this>): void;
    view(): Mithril.Children;
}
