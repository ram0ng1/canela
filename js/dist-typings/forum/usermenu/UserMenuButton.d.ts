import Component from 'flarum/common/Component';
import type Mithril from 'mithril';
export default class UserMenuButton extends Component {
    view(): JSX.Element;
    /** O avatar (e o que se acrescenta a ele), sem o nome de usuário. */
    avatarContent(): Mithril.Children;
    oncreate(vnode: Mithril.VnodeDOM<any, this>): void;
    onupdate(vnode: Mithril.VnodeDOM<any, this>): void;
}
