import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Mithril from 'mithril';
export interface CookedAttrs extends ComponentAttrs {
    text: string;
    streaming?: boolean;
    className?: string;
}
export default class Cooked extends Component<CookedAttrs> {
    rendered: string | null;
    frame: number;
    view(): JSX.Element;
    oncreate(vnode: Mithril.VnodeDOM<CookedAttrs, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<CookedAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<CookedAttrs, this>): void;
    render(): void;
}
