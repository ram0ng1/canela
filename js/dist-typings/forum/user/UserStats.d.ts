import Component, { type ComponentAttrs } from 'flarum/common/Component';
import ItemList from 'flarum/common/utils/ItemList';
import type User from 'flarum/common/models/User';
import type Mithril from 'mithril';
export interface UserStatsAttrs extends ComponentAttrs {
    user: User;
}
export default class UserStats<Attrs extends UserStatsAttrs = UserStatsAttrs> extends Component<Attrs> {
    view(): Mithril.Children;
    /** Cada estatística é um item, para outras extensões poderem somar as suas. */
    items(): ItemList<Mithril.Children>;
    stat(label: string, value: Mithril.Children, title?: string, className?: string): Mithril.Children;
}
