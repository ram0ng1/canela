import Modal, { type IInternalModalAttrs } from 'flarum/common/components/Modal';
import type Discussion from 'flarum/common/models/Discussion';
import type Post from 'flarum/common/models/Post';
import type Mithril from 'mithril';
export interface ShareModalAttrs extends IInternalModalAttrs {
    discussion: Discussion;
    post?: Post | null;
}
export default class ShareModal extends Modal<ShareModalAttrs> {
    copied: boolean;
    className(): string;
    title(): string;
    link(): string;
    content(): Mithril.Children;
}
