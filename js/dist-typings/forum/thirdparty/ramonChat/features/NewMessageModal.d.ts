import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
export default class NewMessageModal extends Modal<IInternalModalAttrs> {
    private query;
    private results;
    private selected;
    private groupName;
    private searching;
    private busy;
    private active;
    private timer;
    private sequence;
    oninit(vnode: Mithril.Vnode<IInternalModalAttrs, this>): void;
    className(): string;
    title(): string;
    content(): JSX.Element;
    private onKeyDown;
    private toggle;
    private search;
    /** O documento do canal (o mesmo do ramon/chat) entra no store e na lista dele. */
    private adopt;
    private open;
    private openSelf;
}
