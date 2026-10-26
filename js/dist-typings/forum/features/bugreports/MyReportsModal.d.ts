import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
export default class MyReportsModal extends Modal<IInternalModalAttrs> {
    private reports;
    oninit(vnode: Mithril.Vnode<IInternalModalAttrs, this>): void;
    className(): string;
    title(): string;
    content(): JSX.Element;
}
