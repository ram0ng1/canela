import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Mithril from 'mithril';
import type { ChatChannel } from '../types';
export interface CreateChannelModalAttrs extends IInternalModalAttrs {
    inDrawer: boolean;
}
export declare class CreateChannelModal extends Modal<CreateChannelModalAttrs> {
    private name;
    private slug;
    private description;
    private tagId;
    private threading;
    private autoJoin;
    className(): string;
    title(): Mithril.Children;
    content(): Mithril.Children;
    private submit;
}
export declare function slugify(text: string): string;
export interface DeleteChannelModalAttrs extends IInternalModalAttrs {
    channel: ChatChannel;
}
/** Excluir de vez: só com o nome do canal digitado. */
export declare class DeleteChannelModal extends Modal<DeleteChannelModalAttrs> {
    private typed;
    className(): string;
    title(): Mithril.Children;
    content(): Mithril.Children;
    private remove;
}
