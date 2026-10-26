import UserPage, { type IUserPageAttrs } from 'flarum/forum/components/UserPage';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import type UserBadge from '../models/UserBadge';
/**
 * A aba "Emblemas" do perfil (/u/:username/badges): cada emblema uma vez,
 * com quantas vezes foi ganho e quando, na ordem ouro → prata → bronze.
 */
export default class UserBadgesPage<Attrs extends IUserPageAttrs = IUserPageAttrs> extends UserPage<Attrs> {
    userBadges: UserBadge[] | null;
    /** O usuário cujos emblemas já foram pedidos: `show()` roda de novo quando o perfil completo chega. */
    private loadedFor;
    oninit(vnode: Mithril.Vnode<Attrs, this>): void;
    show(user: User): void;
    content(): Mithril.Children;
    list(user: User): Mithril.Children;
}
