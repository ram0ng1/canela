import type { IInternalModalAttrs } from 'flarum/common/components/Modal';
import FormModal from 'flarum/common/components/FormModal';
import type Mithril from 'mithril';
interface InviteData {
    id: number;
    code: string;
    url: string;
    maxRedemptions: number;
    redemptionCount: number;
    expiresAt: string | null;
    createdAt: string | null;
    usable: boolean;
}
export default class InviteModal extends FormModal<IInternalModalAttrs> {
    invites: InviteData[] | null;
    signUpOpen: boolean;
    creating: boolean;
    copiedId: number | null;
    maxRedemptions: any;
    expiresDays: any;
    oninit(vnode: Mithril.Vnode<IInternalModalAttrs, this>): void;
    className(): string;
    title(): string;
    load(): void;
    content(): Mithril.Children;
    list(): Mithril.Children;
    remove(invite: InviteData): void;
    onsubmit(event: SubmitEvent): void;
}
export {};
