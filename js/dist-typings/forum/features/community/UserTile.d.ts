import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
export interface UserTileAttrs extends ComponentAttrs {
    user: User;
    /** Uma linha extra abaixo do nome (último acesso, por exemplo). */
    meta?: Mithril.Children;
    size?: 'normal' | 'small';
}
/**
 * Avatar, nome, @usuário e "título" — o bloco de usuário das listas
 * (equipe do "Sobre", diretório, membros de grupo).
 *
 * O Flarum não tem título de usuário; o lugar fica com o nome do primeiro
 * grupo, como quando o título vem de um grupo.
 */
export default class UserTile extends Component<UserTileAttrs> {
    view(): Mithril.Children;
}
