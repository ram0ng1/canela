import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
export default class ContentLanguageModal extends Modal<IInternalModalAttrs> {
    interfaceLocale: string;
    understood: string[];
    auto: boolean;
    saving: boolean;
    oninit(vnode: Mithril.Vnode<IInternalModalAttrs, this>): void;
    className(): string;
    title(): string;
    languages(): string[];
    toggle(code: string): void;
    content(): JSX.Element[];
    save(): void;
}
