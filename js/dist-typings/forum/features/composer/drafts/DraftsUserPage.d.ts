import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
export default class DraftsUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
    private loading;
    oninit(vnode: Mithril.Vnode<Attrs, this>): void;
    show(user: User): void;
    content(): JSX.Element;
    private item;
}
