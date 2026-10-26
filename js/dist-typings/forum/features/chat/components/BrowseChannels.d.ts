import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface BrowseChannelsAttrs extends ComponentAttrs {
    filter?: string;
    inDrawer: boolean;
}
export default class BrowseChannels extends Component<BrowseChannelsAttrs> {
    private filter;
    private query;
    private channels;
    private timer;
    private busy;
    oninit(vnode: Mithril.Vnode<BrowseChannelsAttrs, this>): void;
    private load;
    view(): Mithril.Children;
    private card;
    private toggle;
}
