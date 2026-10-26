import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
import type { ChatChannel } from '../types';
export interface ChannelInfoAttrs extends ComponentAttrs {
    channel: ChatChannel;
    tab: 'settings' | 'members';
    inDrawer: boolean;
}
export default class ChannelInfo extends Component<ChannelInfoAttrs> {
    view(): Mithril.Children;
    private tab;
}
