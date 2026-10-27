import type { IInternalModalAttrs } from 'flarum/common/components/Modal';
import FormModal from 'flarum/common/components/FormModal';
import type Mithril from 'mithril';
import type Invite from './Invite';
export default class InviteModal extends FormModal<IInternalModalAttrs> {
    invites: Invite[] | null;
    signUpOpen: boolean;
    /** Falso para quem perdeu a permissão: a janela só lista e revoga. */
    canCreate: boolean;
    creating: boolean;
    copiedId: string | null;
    maxRedemptions: any;
    expiresDays: any;
    oninit(vnode: Mithril.Vnode<IInternalModalAttrs, this>): void;
    className(): string;
    title(): string;
    load(): void;
    content(): Mithril.Children;
    list(): Mithril.Children;
    remove(invite: Invite): void;
    onsubmit(event: SubmitEvent): void;
}
