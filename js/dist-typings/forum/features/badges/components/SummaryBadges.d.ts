import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
import type UserBadge from '../models/UserBadge';
export interface SummaryBadgesAttrs extends ComponentAttrs {
    user: User;
}
/**
 * A seção "Melhores emblemas" da aba Resumo do perfil. Sem emblema
 * nenhum, a seção some: o resumo de quem acabou de chegar não precisa dela.
 */
export default class SummaryBadges extends Component<SummaryBadgesAttrs> {
    userBadges: UserBadge[] | null;
    oninit(vnode: Mithril.Vnode<SummaryBadgesAttrs, this>): void;
    view(): JSX.Element | null;
}
