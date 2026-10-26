import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import type Mithril from 'mithril';
export interface EventBuilderModalAttrs extends IFormModalAttrs {
}
export default class EventBuilderModal extends FormModal<EventBuilderModalAttrs> {
    private form;
    private editing;
    private startDate;
    private startTime;
    private endDate;
    private endTime;
    private error;
    oninit(vnode: Mithril.Vnode<EventBuilderModalAttrs, this>): void;
    className(): string;
    title(): string;
    private input;
    content(): JSX.Element;
    onsubmit(event: SubmitEvent): void;
    private remove;
    /**
     * Troca o [event] que já existe, ou põe o novo no começo do texto. Pelo
     * editor (e não direto no campo): ele avisa o composer da mudança.
     */
    private write;
}
