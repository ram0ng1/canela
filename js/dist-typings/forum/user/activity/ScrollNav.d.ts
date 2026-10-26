import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface ScrollNavAttrs extends ComponentAttrs {
    className?: string;
}
export default class ScrollNav extends Component<ScrollNavAttrs> {
    private list;
    private observer;
    private readonly sync;
    view(vnode: Mithril.Vnode<ScrollNavAttrs, this>): JSX.Element;
    oncreate(vnode: Mithril.VnodeDOM<ScrollNavAttrs, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<ScrollNavAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<ScrollNavAttrs, this>): void;
    private updateArrows;
    private scrollBy;
}
