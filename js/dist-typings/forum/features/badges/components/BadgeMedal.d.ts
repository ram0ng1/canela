import Component, { type ComponentAttrs } from 'flarum/common/Component';
import type Badge from '../models/Badge';
export interface BadgeMedalAttrs extends ComponentAttrs {
    className?: string;
    badge: Badge;
    size?: 'small' | 'medium' | 'large';
}
/**
 * O ícone do emblema dentro de uma medalha redonda na cor do tipo — ouro,
 * prata ou bronze. Um emblema com imagem
 * (definida no admin) mostra a imagem no lugar do ícone. O tipo também vai no
 * `title`, para não depender só da cor.
 */
export default class BadgeMedal extends Component<BadgeMedalAttrs> {
    view(): JSX.Element;
}
