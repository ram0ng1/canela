import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
export interface DraftCloseModalAttrs extends IInternalModalAttrs {
    ondiscard: () => void;
    onsave: () => void;
}
export default class DraftCloseModal extends Modal<DraftCloseModalAttrs> {
    className(): string;
    title(): string;
    content(): JSX.Element;
}
