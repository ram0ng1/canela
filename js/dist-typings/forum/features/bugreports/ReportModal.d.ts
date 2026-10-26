import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import type Mithril from 'mithril';
import type { ReportContext } from './context';
export type Kind = 'bug' | 'content' | 'design' | 'idea';
export declare const KINDS: Kind[];
export declare const KIND_ICONS: Record<Kind, string>;
export declare const apiUrl: (path: string) => string;
export interface ReportModalAttrs extends IFormModalAttrs {
    region: string;
    /** A tela inteira, que fica pronta em segundo plano. */
    full: Promise<string | null>;
    context: ReportContext;
    onAnother: () => void;
}
export default class ReportModal extends FormModal<ReportModalAttrs> {
    private kind;
    private description;
    private currentText;
    private suggestedText;
    oninit(vnode: Mithril.Vnode<ReportModalAttrs, this>): void;
    className(): string;
    title(): string;
    content(): JSX.Element;
    another(): void;
    onsubmit(e: SubmitEvent): void;
}
