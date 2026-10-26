import Component from 'flarum/common/Component';
import type Mithril from 'mithril';
/** O ⌄ só existe com rascunhos (e com o fof-drafts ligado). */
export declare function showDraftsMenu(): boolean;
export default class DraftsMenu extends Component {
    private readonly place;
    oninit(vnode: Mithril.Vnode): void;
    oncreate(vnode: Mithril.VnodeDOM): void;
    onupdate(vnode: Mithril.VnodeDOM): void;
    onremove(vnode: Mithril.VnodeDOM): void;
    view(): JSX.Element;
    items(): Mithril.Children[];
}
