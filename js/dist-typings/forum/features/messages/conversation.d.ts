import Component, { type ComponentAttrs } from 'flarum/common/Component';
import FormModal, { type IFormModalAttrs } from 'flarum/common/components/FormModal';
import type Mithril from 'mithril';
import { type Dialog } from './util';
export declare function DialogMap(dialog: Dialog): Mithril.Children;
export interface DialogEvent {
    id: number;
    type: 'invited_user' | 'invited_group' | 'removed_user' | 'user_left';
    createdAt: string;
    actorId: string | null;
    actorUsername: string | null;
    targetUserId: string | null;
    targetUsername: string | null;
    groupName: string | null;
}
export declare function dialogEvents(dialog: Dialog): DialogEvent[];
/**
 * O post de ação pequena (`.small-action`): o ícone na coluna do
 * avatar, o avatar de quem fez e "Convidou @fulano há 2 dias".
 */
export declare function DialogEventView(event: DialogEvent): Mithril.Children;
interface InviteModalAttrs extends IFormModalAttrs {
    dialog: Dialog;
}
/**
 * "Convidar" (`invite` do tópico de mensagem): o mesmo seletor de pessoas e
 * grupos do composer e "✉ Enviar convite", desabilitado até alguém ser
 * escolhido.
 */
export declare class InviteModal extends FormModal<InviteModalAttrs> {
    users: any;
    group: any;
    className(): string;
    title(): Mithril.Children;
    content(): Mithril.Children;
    onsubmit(e: SubmitEvent): void;
}
interface DialogTimelineAttrs extends ComponentAttrs {
    dialog: Dialog;
    onreply: () => void;
}
/**
 * A linha do tempo do tópico, no tamanho de uma mensagem: a data da primeira
 * no topo, a trilha com "n/n" e a data da última, a data embaixo e os botões
 * redondos de responder e de notificação.
 */
export declare class DialogTimeline extends Component<DialogTimelineAttrs> {
    view(): Mithril.Children;
}
/** Com o backend e a migration de grupos: o nível vem no diálogo. */
export declare function levelsOn(dialog: Dialog): boolean;
interface DialogNotificationsAttrs extends ComponentAttrs {
    dialog: Dialog;
    compact?: boolean;
}
export declare class DialogNotifications extends Component<DialogNotificationsAttrs> {
    view(): Mithril.Children;
}
/** "Você receberá notificações porque…" — o texto ao lado do botão no rodapé. */
export declare function notificationReason(dialog: Dialog): string;
export {};
