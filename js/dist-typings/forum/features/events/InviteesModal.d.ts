import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
import { type EventData } from './model';
export interface InviteesModalAttrs extends IInternalModalAttrs {
    event: EventData;
    title: string;
}
export default class InviteesModal extends Modal<InviteesModalAttrs> {
    private tab;
    private lists;
    private counts;
    oninit(vnode: Mithril.Vnode<InviteesModalAttrs, this>): void;
    className(): string;
    title(): string;
    private load;
    content(): JSX.Element;
}
