import Component from 'flarum/common/Component';
import type Mithril from 'mithril';
export default class ChatDrawer extends Component {
    private resizing;
    view(): Mithril.Children;
    /** Esc fecha a gaveta. */
    private onKeyDown;
    private startResize;
}
