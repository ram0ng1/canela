import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
export default class ReactionsUserPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
    private rows;
    private loading;
    private hasMore;
    oninit(vnode: Mithril.Vnode<Attrs, this>): void;
    show(user: User): void;
    content(): JSX.Element;
    private reactionRow;
    /** O emoji do fof (a mesma imagem dos posts); a curtida é a reação "heart", ou o coração. */
    private emoji;
    /** Um item por post; curtida e coração do fof no mesmo post contam uma vez. */
    private groups;
    private load;
}
