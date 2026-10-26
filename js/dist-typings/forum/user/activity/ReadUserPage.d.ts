import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import DiscussionListState from 'flarum/forum/states/DiscussionListState';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
export default class ReadUserPage extends UserPage<IUserPageAttrs, DiscussionListState> {
    oninit(vnode: Mithril.Vnode<IUserPageAttrs, this>): void;
    show(user: User): void;
    content(): JSX.Element;
}
