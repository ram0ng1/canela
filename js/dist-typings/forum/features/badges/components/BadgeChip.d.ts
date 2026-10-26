import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Badge from '../models/Badge';
export interface BadgeChipAttrs extends ComponentAttrs {
    className?: string;
    badge: Badge;
    username?: string;
    count?: number;
}
/** O emblema em pílula (medalha pequena + nome): o cartão do usuário e o resumo. */
export default class BadgeChip extends Component<BadgeChipAttrs> {
    view(): JSX.Element;
}
