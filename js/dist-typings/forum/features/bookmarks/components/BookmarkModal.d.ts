import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import Stream from 'flarum/common/utils/Stream';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
import { type ReminderPreset } from '../reminders';
export interface BookmarkModalAttrs extends IFormModalAttrs {
    post: Post;
}
export default class BookmarkModal extends FormModal<BookmarkModalAttrs> {
    name: Stream<string>;
    preset: ReminderPreset | null;
    customDate: Stream<string>;
    customTime: Stream<string>;
    /** O lembrete que já existia: continua valendo se nenhum atalho for escolhido. */
    existingReminder: Date | null;
    oninit(vnode: Mithril.Vnode<BookmarkModalAttrs, this>): void;
    className(): string;
    title(): string;
    content(): JSX.Element;
    /** De qual post é o marcador: "Post de Fulano em Título". */
    context(): string | null;
    /**
     * Uma linha da lista: ícone, rótulo, o horário à direita e ✓ na escolhida.
     * A data e a hora personalizadas abrem logo abaixo da própria linha.
     */
    presetButton(preset: ReminderPreset): Mithril.Children;
    /**
     * O lembrete a gravar: `undefined` mantém o atual, `null` tira, uma data
     * troca. `false` quando o horário personalizado é inválido.
     *
     * Só vai no PATCH o que a pessoa mudou: sem atalho escolhido, ou "Nenhum"
     * sem lembrete pendente (o que já passou e foi enviado), o campo fica de
     * fora e o histórico do lembrete continua no marcador.
     */
    chosenReminder(): Date | null | undefined | false;
    onsubmit(e: SubmitEvent): void;
    remove(): void;
}
