import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
export interface CookedFullscreenModalAttrs extends IInternalModalAttrs {
    title: string;
    html: string;
    kind: 'code' | 'table';
}
export default class CookedFullscreenModal extends Modal<CookedFullscreenModalAttrs> {
    className(): string;
    title(): string;
    content(): Mithril.Children;
}
