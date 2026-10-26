import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
export interface DiffModalAttrs extends IInternalModalAttrs {
    mode: string;
    text: string;
    language?: string;
    customPrompt?: string;
    context?: string;
    /** Troca o texto original pelo novo no editor. */
    apply: (text: string) => void;
}
export default class DiffModal extends Modal<DiffModalAttrs> {
    suggestion: string;
    final: string | null;
    waiting: boolean;
    streaming: boolean;
    controller: AbortController | null;
    oninit(vnode: Mithril.Vnode<DiffModalAttrs, this>): void;
    onremove(vnode: Mithril.VnodeDOM<DiffModalAttrs, this>): void;
    className(): string;
    title(): string;
    content(): JSX.Element[];
    footer(): Mithril.Children;
    request(): void;
    confirm(): void;
    copy(): void;
}
