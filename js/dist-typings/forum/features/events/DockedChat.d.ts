import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface DockedChatAttrs extends ComponentAttrs {
    channelId: number;
}
export declare const DOCKED_CLASS = "CanelaEventChat--docked";
/** A coluna cabe: computador, o leitor usa o chat e há um canal. */
export declare function canDock(): boolean;
export default class DockedChat extends Component<DockedChatAttrs> {
    private ChannelView;
    private channel;
    private failed;
    oninit(vnode: Mithril.Vnode<DockedChatAttrs, this>): void;
    oncreate(vnode: Mithril.VnodeDOM<DockedChatAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<DockedChatAttrs, this>): void;
    private load;
    view(): Mithril.Children;
}
