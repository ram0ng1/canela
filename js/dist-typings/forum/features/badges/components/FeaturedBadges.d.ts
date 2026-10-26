import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import type UserBadge from '../models/UserBadge';
export interface FeaturedBadgesAttrs extends ComponentAttrs {
    className?: string;
    user: User;
    /** Quantos emblemas à vista antes do "+N". */
    limit?: number;
}
/**
 * Os emblemas de destaque de alguém, no cartão do usuário:
 * os primeiros na ordem ouro → prata → bronze, e um "+N" que leva à aba
 * Emblemas do perfil. Some por inteiro enquanto carrega e quando não há
 * emblema — um cartão não precisa avisar que alguém ainda não ganhou nada.
 */
export default class FeaturedBadges extends Component<FeaturedBadgesAttrs> {
    userBadges: UserBadge[] | null;
    oninit(vnode: Mithril.Vnode<FeaturedBadgesAttrs, this>): void;
    view(): JSX.Element | null;
}
