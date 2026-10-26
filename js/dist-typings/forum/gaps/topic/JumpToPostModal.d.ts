import type { IInternalModalAttrs } from 'flarum/common/components/Modal';
import FormModal from 'flarum/common/components/FormModal';
import type Mithril from 'mithril';
export interface JumpToPostModalAttrs extends IInternalModalAttrs {
    stream: any;
}
export default class JumpToPostModal extends FormModal<JumpToPostModalAttrs> {
    number: any;
    className(): string;
    title(): string;
    content(): Mithril.Children;
    onsubmit(event: SubmitEvent): void;
}
